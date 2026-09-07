import { execFile } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// ntn inspects stdin for an optional JSON body. End the pipe so noninteractive
// invocations do not wait indefinitely for input already provided with -d.
const runFile = (file, args, options) => new Promise((resolve, reject) => {
  const child = execFile(file, args, options, (error, stdout, stderr) => {
    if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
    else resolve({ stdout, stderr });
  });
  child.stdin?.end();
});
const API_VERSION = '2026-03-11';
export function validateSourceId(sourceId) {
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(sourceId ?? '')) {
    throw new Error('Set NOTION_DATA_SOURCE_ID or --source to the Notion data source UUID. Keep private identifiers out of public files.');
  }
  return sourceId;
}

export async function withRetry(operation, { wait = sleep, attempts = 5 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await operation(); } catch (error) {
      const transient = error.retryable || error.status === 429 || error.status === 409 || error.status >= 500;
      if (!transient || attempt === attempts - 1) throw error;
      const delay = Math.min(60000, Math.max(0, error.retryAfterMs ?? 500 * 2 ** attempt));
      await wait(delay);
    }
  }
}

function apiError(data, status) {
  // No raw API payloads, page IDs, or credentials in console output.
  const error = new Error(`Notion read request failed (${status ?? data?.code ?? 'unknown error'}). Check integration access and source configuration.`);
  error.status = Number(status ?? data?.status) || undefined;
  if (data?.code === 'rate_limited') error.status = 429;
  if (['internal_server_error', 'service_unavailable', 'gateway_timeout'].includes(data?.code)) error.status = 503;
  return error;
}

export function createNotionReader({ cli = false, token = process.env.NOTION_API_TOKEN, version = process.env.NOTION_API_VERSION ?? API_VERSION, fetchImpl = fetch, execImpl = runFile, wait = sleep } = {}) {
  if (!cli && !token) throw new Error('Set NOTION_API_TOKEN for an integration, or use --cli with an authenticated ntn installation.');
  return (path, body) => withRetry(async () => {
    // Only two read operations are allowed: querying a source and retrieving a page property.
    if (!(body && /^v1\/data_sources\/[0-9a-f-]+\/query$/i.test(path)) && !(body === undefined && /^v1\/pages\/[0-9a-f-]+\/properties\//i.test(path))) {
      throw new Error('Unsupported Notion operation; this exporter is read-only.');
    }
    if (cli) {
      const args = ['api', path, '--notion-version', version, '-X', body ? 'POST' : 'GET'];
      if (body) args.push('-d', JSON.stringify(body));
      let output;
      try { output = await execImpl('ntn', args, { maxBuffer: 32 * 1024 * 1024, timeout: 60000 }); }
      catch (failure) {
        let parsed;
        try { parsed = JSON.parse(failure.stdout || failure.stderr); } catch { /* CLI errors may be plain text. */ }
        if (parsed?.object === 'error' || parsed?.status || parsed?.code) throw apiError(parsed);
        const error = new Error('ntn could not read Notion. Check local login, network access, and keychain access.');
        error.retryable = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(failure.code);
        throw error;
      }
      let data;
      try { data = JSON.parse(output.stdout); } catch { throw new Error('ntn returned invalid JSON; export aborted.'); }
      if (data.object === 'error') throw apiError(data);
      return data;
    }
    let response;
    try {
      response = await fetchImpl(`https://api.notion.com/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': version, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
      });
    } catch { const error = new Error('Notion network read failed.'); error.retryable = true; throw error; }
    if (!response.ok) {
      const error = apiError(null, response.status);
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) error.retryAfterMs = /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
      throw error;
    }
    return response.json();
  }, { wait });
}

export async function paginate(requestPage) {
  const all = [];
  const cursors = new Set();
  let cursor;
  do {
    const response = await requestPage(cursor);
    if (!Array.isArray(response.results) || typeof response.has_more !== 'boolean') throw new Error('Notion returned an invalid paginated response; no data was written.');
    if (response.request_status?.type === 'incomplete') throw new Error('Notion marked this query incomplete; no data was written. Narrow the source or resolve its query limit.');
    all.push(...response.results);
    if (!response.has_more) break;
    cursor = response.next_cursor;
    if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) throw new Error('Notion pagination did not advance; no data was written.');
    cursors.add(cursor);
    if (cursors.size > 10000) throw new Error('Notion pagination exceeded the safety limit.');
  } while (true);
  return all;
}

export async function queryAllPages(reader, sourceId) {
  validateSourceId(sourceId);
  const pages = await paginate((cursor) => reader(`v1/data_sources/${sourceId}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }));
  const seen = new Set();
  for (const page of pages) {
    if (typeof page.id !== 'string' || seen.has(page.id)) throw new Error('Notion returned a missing or duplicate page identity; rerun after concurrent edits finish.');
    seen.add(page.id);
    // Large rich-text/title properties can be truncated by page retrieval; fetch their full property list.
    for (const property of Object.values(page.properties ?? {})) {
      if (!['title', 'rich_text'].includes(property.type)) continue;
      if (!property.has_more && (property[property.type]?.length ?? 0) < 25) continue;
      if (!property.id) throw new Error('A truncated Notion property has no identity; export aborted.');
      const propertyId = encodeURIComponent(decodeURIComponent(property.id));
      const entries = await paginate((cursor) => reader(`v1/pages/${page.id}/properties/${propertyId}?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`));
      property[property.type] = entries.map((entry) => entry[property.type]);
      if (property[property.type].some((item) => !item)) throw new Error('Notion returned an invalid text property; export aborted.');
      delete property.has_more;
    }
  }
  return pages;
}
