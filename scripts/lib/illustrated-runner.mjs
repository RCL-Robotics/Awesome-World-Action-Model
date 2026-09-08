import { access, copyFile, lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { hashText, readJSON, writeJSON, validateReport } from './reports.mjs';
import { validateIllustratedReport, validateIllustratedMetadata } from './illustrated-reports.mjs';

const RUNTIME = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies');
export const DEFAULT_PYTHON = join(RUNTIME, 'python/bin/python3');
export const DEFAULT_PDFTOPPM = join(RUNTIME, 'bin/override/pdftoppm');
const DEFAULT_FONTS = join(RUNTIME, 'native/poppler/poppler/fonts');
const execute = promisify(execFile);
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const fileHash = async path => sha(await readFile(path));
export async function optionalJSON(path) { try { return await readJSON(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
export async function exists(path) { try { await access(path); return true; } catch { return false; } }
export function assertWithin(root, path) {
  const part = relative(resolve(root), resolve(path));
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`)) throw new Error('Path escapes the allowed directory');
  return resolve(path);
}
export async function safeFile(root, name, maxBytes = 30_000_000) {
  if (isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error('Unsafe artifact path');
  const path = assertWithin(root, join(root, name));
  let cursor = resolve(root);
  for (const component of relative(root, path).split(sep)) {
    cursor = join(cursor, component);
    if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symlink artifacts are forbidden');
  }
  const stat = await lstat(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes) throw new Error('Artifact must be a bounded regular file without hard links');
  assertWithin(await realpath(root), await realpath(path));
  return path;
}
export async function safeDestination(root, name) {
  const path = assertWithin(root, join(root, name));
  let cursor = resolve(root);
  for (const component of relative(root, path).split(sep)) {
    cursor = join(cursor, component);
    try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symlink publication destination'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}
export function pngDimensions(bytes) {
  if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
export async function verifySource(manifest, workDir) {
  if (!/^[a-zA-Z0-9._-]+$/.test(manifest.paperId) || manifest.titleMatch !== true || !['full-text', 'partial-text'].includes(manifest.accessStatus)) throw new Error('Source identity/access is not verified');
  for (const [field, expected] of [['sourcePath', manifest.sha256], ['textPath', manifest.textSha256]]) {
    if (!/^[a-f0-9]{64}$/.test(expected || '') || !manifest[field]) throw new Error(`Missing ${field} fingerprint`);
    const path = await realpath(manifest[field]);
    assertWithin(await realpath(workDir), path);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 400_000_000) throw new Error('Source must be a bounded regular file');
    if (await fileHash(path) !== expected) throw new Error(`${field} hash mismatch`);
  }
}
function splitSourceText(text) {
  const parts = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 12_000, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}
export async function verifyStoredContext(context, manifest, { python = DEFAULT_PYTHON, pdftoppm = DEFAULT_PDFTOPPM } = {}) {
  const config = context.config;
  if (!config || config.python !== python || config.pdftoppm !== pdftoppm || config.sourceFile !== (manifest.kind === 'pdf' ? 'source.pdf' : 'source.raw') || JSON.stringify(config.manifest) !== JSON.stringify(manifest)) throw new Error('Untrusted retained source configuration');
  const text = await readFile(manifest.textPath, 'utf8');
  if (hashText(text) !== manifest.textSha256) throw new Error('Retained source text fingerprint changed');
  const expected = splitSourceText(text).map((part, index) => ({ path: `chunks/${index + 1}.txt`, sha256: hashText(part) }));
  if (!expected.length || JSON.stringify(config.chunks) !== JSON.stringify(expected)) throw new Error('Retained text chunk inventory changed');
}
export async function snapshotSource({ attempt, manifest, repository, python = DEFAULT_PYTHON, pdftoppm = DEFAULT_PDFTOPPM }) {
  await mkdir(join(attempt, 'chunks'), { recursive: true });
  const sourceFile = manifest.kind === 'pdf' ? 'source.pdf' : 'source.raw';
  await copyFile(manifest.sourcePath, join(attempt, sourceFile));
  await copyFile(manifest.textPath, join(attempt, 'source.txt'));
  if (await fileHash(join(attempt, sourceFile)) !== manifest.sha256 || await fileHash(join(attempt, 'source.txt')) !== manifest.textSha256) throw new Error('Source changed during snapshot');
  const text = await readFile(join(attempt, 'source.txt'), 'utf8');
  const chunks = [];
  // Preserve every character, including extraction page labels. Small chunks fit a tool response.
  for (const value of splitSourceText(text)) {
    const name = `chunks/${chunks.length + 1}.txt`;
    await writeFile(join(attempt, name), value);
    chunks.push({ path: name, sha256: hashText(value) });
  }
  if (!chunks.length) throw new Error('Source text is empty');
  await copyFile(join(repository, 'scripts/reading/illustrated-source.py'), join(attempt, 'source-tool.py'));
  await writeFile(join(attempt, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${DEFAULT_FONTS}</dir><cachedir>${attempt}/fontcache</cachedir></fontconfig>`);
  const config = { sourceFile, manifest, chunks, python, pdftoppm };
  await writeJSON(join(attempt, 'source-config.json'), config);
  return config;
}
export function inspectedImagePaths(events) {
  const paths = new Set();
  const started = new Map();
  function walk(value, vision = false) {
    if (!value || typeof value !== 'object') return;
    const tool = [value.type, value.name, value.tool, value.tool_name].filter(x => typeof x === 'string').join(' ');
    vision ||= /(?:^|\W)(?:view_image|image_view)(?:$|\W)/.test(tool);
    if (vision) for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && ['path', 'file_path', 'image_path'].includes(key)) paths.add(item);
      if (typeof item === 'string' && ['arguments', 'input'].includes(key)) { try { walk(JSON.parse(item), true); } catch {} }
    }
    for (const item of Object.values(value)) if (typeof item === 'object') walk(item, vision);
  }
  for (const event of events) {
    const item = event.item || event;
    if (event.type === 'item.started' && item.id) started.set(item.id, item);
    if (event.type !== 'item.completed' || /failed|error|cancelled|interrupted/.test(item.status || '') || item.error || item.result?.isError) continue;
    walk({ ...started.get(item.id), ...item });
  }
  return paths;
}
export async function validateBundle({ attempt, context, verifyCrops = verifyOriginalCrops, reviewImages }) {
  const read = async name => JSON.parse(await readFile(await safeFile(attempt, name, 3_000_000), 'utf8'));
  const receipt = await read('receipt.json');
  const fields = ['schemaVersion', 'paperId', 'outcome', 'reason', 'evidenceIds', 'baseReportPath', 'editionPath', 'metadataPath'];
  if (Object.keys(receipt).length !== fields.length || fields.some(key => !Object.hasOwn(receipt, key)) || receipt.schemaVersion !== 1 || receipt.paperId !== context.paper.id || receipt.baseReportPath !== 'report.json' || receipt.metadataPath !== 'metadata.json' || !['illustrated', 'illustration-unavailable'].includes(receipt.outcome) || typeof receipt.reason !== 'string' || !Array.isArray(receipt.evidenceIds)) throw new Error('Invalid worker receipt');
  const { manifest, classification, generatedAt } = context;
  const config = await read('source-config.json');
  if (JSON.stringify(config) !== JSON.stringify(context.config)) throw new Error('Source configuration changed');
  if (await fileHash(await safeFile(attempt, config.sourceFile, 400_000_000)) !== manifest.sha256 || await fileHash(await safeFile(attempt, 'source.txt', 100_000_000)) !== manifest.textSha256) throw new Error('Source snapshot changed');
  const draft = await read('report.json');
  // Acquisition limitations belong to the verified source, independently of
  // the writer's description of how it addressed those limitations.
  const sourceOmissionsAdded = Array.isArray(draft.coverage?.omissions)
    ? (manifest.omissions || []).filter(note => !draft.coverage.omissions.includes(note)) : [];
  const normalized = sourceOmissionsAdded.length
    ? { ...draft, coverage: { ...draft.coverage, omissions: [...sourceOmissionsAdded, ...draft.coverage.omissions] } } : draft;
  const report = validateReport(normalized, { paperIds: context.paperIds, manifest });
  if (report.generatedAt !== generatedAt || JSON.stringify(report.taxonomy.recordedClassification) !== JSON.stringify(classification)) throw new Error('Report generation/classification provenance changed');
  const metadata = validateIllustratedMetadata(await read('metadata.json'), report);
  if (metadata.title !== manifest.observedTitle) throw new Error('Verified metadata title differs from primary identity');
  const evidence = new Set(report.evidence.map(item => item.id));
  if (receipt.evidenceIds.some(id => !evidence.has(id))) throw new Error('Unresolved receipt evidence');
  const auditText = await readFile(await safeFile(attempt, 'source-audit.jsonl'), 'utf8');
  const audit = auditText.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  for (const [index, chunk] of config.chunks.entries()) if (!audit.some(entry => entry.operation === 'read' && entry.chunk === index + 1 && entry.sha256 === chunk.sha256)) throw new Error(`Primary text chunk ${index + 1} was not read`);
  // Worker-writable tool logs are diagnostics only. Every PDF bundle receives
  // coordinator-controlled image delivery and an independent review below.
  const pageRecords = new Map(), requiredImages = [];
  function requirePage(page) {
    const entry = audit.findLast(entry => entry.operation === 'render' && entry.page === page);
    if (!Number.isInteger(page) || !entry || !new RegExp(`^renders/page-${page}-[0-9]+\\.png$`).test(entry.path)) throw new Error('A declared inspected page has no original render record');
    pageRecords.set(page, entry);
  }
  if (manifest.kind === 'pdf') requirePage(metadata.page);
  let edition = null, assets = [];
  if (receipt.outcome === 'illustration-unavailable') {
    if (receipt.editionPath !== null || !receipt.reason.trim() || !receipt.evidenceIds.length || await exists(join(attempt, 'edition.json'))) throw new Error('Unavailable outcome must be explicit and must not include an edition');
    if (manifest.kind === 'pdf' && manifest.scope !== 'abstract-only') throw new Error('A readable PDF requires a visual edition or a recoverable error, not an unavailable shortcut');
  } else {
    if (receipt.editionPath !== 'edition.json') throw new Error('Missing illustrated edition');
    edition = validateIllustratedReport(await read('edition.json'), report);
    for (const page of edition.visualAudit.inspectedPages) requirePage(page);
    for (const visual of edition.visuals) {
      const name = `assets/${visual.id}.png`, bytes = await readFile(await safeFile(attempt, name));
      const [width, height] = pngDimensions(bytes);
      if (width !== visual.width || height !== visual.height) throw new Error('PNG dimensions disagree with edition');
      const crop = audit.findLast(entry => entry.operation === 'crop' && entry.id === visual.id && entry.sha256 === sha(bytes) && entry.page === visual.page && JSON.stringify(entry.crop) === JSON.stringify(visual.crop));
      if (!crop || crop.path !== name || !Number.isInteger(crop.dpi) || crop.dpi < 180 || crop.dpi > 600 || crop.width !== width || crop.height !== height) throw new Error('Crop lacks exact source provenance');
      requirePage(visual.page);
      requiredImages.push({ imageId: `crop-${visual.id}`, path: name, sha256: crop.sha256, page: visual.page, kind: 'crop', description: visual });
      assets.push({ ...crop, destination: `public/${visual.asset}` });
    }
  }
  for (const [page, entry] of pageRecords) requiredImages.unshift({ imageId: `page-${page}`, path: entry.path, page, kind: 'source-page', description: page === metadata.page ? metadata : `Original PDF page ${page}, including original labels, caption and surrounding evidence.` });
  if (requiredImages.length) {
    const verification = await verifyCrops({ attempt, context, assets, pages: [...pageRecords.keys()] });
    {
      if (!reviewImages) throw new Error('Source pages and final crops require independent attached-image review');
      const images = [];
      for (const item of requiredImages) {
        // Reviewer receives independent renders, never writer-controlled page screenshots.
        const path = item.kind === 'source-page' ? join(verification.directory, `renders/page-${item.page}-200.png`) : join(verification.directory, item.path);
        images.push({ ...item, path, sha256: await fileHash(path) });
      }
      if (await reviewImages({ attempt, context, report, edition, metadata, images }) !== true) throw new Error('Independent image review did not approve this bundle');
    }
  }
  return { receipt, report, edition, metadata, assets, sourceOmissionsAdded };
}
export async function verifyOriginalCrops({ attempt, context, assets, pages = [] }) {
  const directory = join(dirname(attempt), `verification-${Date.now()}`);
  await mkdir(directory);
  const config = context.config;
  for (const name of [config.sourceFile, 'source.txt']) await copyFile(join(attempt, name), join(directory, name));
  await writeFile(join(directory, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${DEFAULT_FONTS}</dir><cachedir>${directory}/fontcache</cachedir></fontconfig>`);
  await writeJSON(join(directory, 'source-config.json'), config);
  await writeJSON(join(directory, 'crops.json'), assets);
  const { stdout } = await execute(config.python, [join(context.repository, 'scripts/reading/illustrated-source.py'), '--root', directory, 'verify', join(directory, 'crops.json')], { timeout: 300_000, maxBuffer: 2_000_000 });
  const expected = JSON.parse(stdout);
  if (expected.length !== assets.length || expected.some((item, index) => item.sha256 !== assets[index].sha256 || item.width !== assets[index].width || item.height !== assets[index].height)) throw new Error('Crop pixels do not match a fresh render of the verified primary PDF');
  for (const page of pages) await execute(config.python, [join(context.repository, 'scripts/reading/illustrated-source.py'), '--root', directory, 'render', String(page)], { timeout: 60_000, maxBuffer: 2_000_000 });
  return { directory };
}
export function validateVisualReview(review, { paperId, sourceSha256, images }) {
  if (review.schemaVersion !== 1 || review.paperId !== paperId || review.sourceSha256 !== sourceSha256 || review.approved !== true || review.identityMatches !== true || typeof review.identityNotes !== 'string' || !review.identityNotes.trim() || !Array.isArray(review.images) || review.images.length !== images.length) throw new Error('Independent visual reviewer rejected identity or bundle');
  const seen = new Set();
  for (const item of review.images) {
    const image = images.find(image => image.imageId === item.imageId);
    if (!image || seen.has(item.imageId) || item.sha256 !== image.sha256 || item.legible !== true || item.matchesDescription !== true || item.claimsSupported !== true || typeof item.observedDetail !== 'string' || !item.observedDetail.trim()) throw new Error('Independent visual reviewer rejected an image, claim or fingerprint');
    seen.add(item.imageId);
  }
  return true;
}
export async function publishBundle(repository, attempt, bundle) {
  const id = bundle.report.paperId;
  if (await exists(join(repository, `data/illustrated-reports/${id}.json`))) throw new Error('Refusing to overwrite an existing illustrated edition');
  const records = [];
  async function json(name, value) {
    const destination = await safeDestination(repository, name);
    await writeJSON(destination, value);
    records.push({ path: name, sha256: await fileHash(destination) });
  }
  for (const asset of bundle.assets) {
    const destination = await safeDestination(repository, asset.destination);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await copyFile(await safeFile(attempt, asset.path), temporary);
    await rename(temporary, destination);
    records.push({ path: asset.destination, sha256: asset.sha256 });
  }
  await json(`data/reports/${id}.json`, bundle.report);
  const metadataPath = await safeDestination(repository, 'data/illustrated-report-metadata.json');
  const metadata = await optionalJSON(metadataPath) || {};
  metadata[id] = bundle.metadata;
  await writeJSON(metadataPath, metadata);
  // The edition is the public commit marker, written only after its dependencies.
  if (bundle.edition) await json(`data/illustrated-reports/${id}.json`, bundle.edition);
  return { files: records, metadataSha256: hashText(JSON.stringify(bundle.metadata)) };
}
export async function publishedReceipt(repository, bundle) {
  const id = bundle.report.paperId;
  const expected = [[`data/reports/${id}.json`, bundle.report]];
  if (bundle.edition) expected.push([`data/illustrated-reports/${id}.json`, bundle.edition]);
  const files = [];
  for (const [path, value] of expected) {
    const file = await safeFile(repository, path);
    if (JSON.stringify(await readJSON(file)) !== JSON.stringify(value)) throw new Error('Interrupted publication differs from the accepted bundle');
    files.push({ path, sha256: await fileHash(file) });
  }
  for (const asset of bundle.assets) {
    if (await fileHash(await safeFile(repository, asset.destination)) !== asset.sha256) throw new Error('Interrupted publication crop differs from the accepted bundle');
    files.push({ path: asset.destination, sha256: asset.sha256 });
  }
  const metadata = await readJSON(join(repository, 'data/illustrated-report-metadata.json'));
  const metadataSha256 = hashText(JSON.stringify(bundle.metadata));
  if (hashText(JSON.stringify(metadata[id])) !== metadataSha256) throw new Error('Interrupted publication metadata differs from the accepted bundle');
  return { files, metadataSha256 };
}
export async function verifyCompletion(repository, status, manifest) {
  if (!['complete', 'illustration-unavailable'].includes(status?.state)) return false;
  if (status.sourceSha256 !== manifest.sha256 || status.textSha256 !== manifest.textSha256 || !Array.isArray(status.files) || !status.files.length) throw new Error('Completed bundle provenance changed');
  for (const item of status.files) if (await fileHash(await safeFile(repository, item.path)) !== item.sha256) throw new Error(`Published artifact changed: ${item.path}`);
  const metadata = await readJSON(join(repository, 'data/illustrated-report-metadata.json'));
  if (hashText(JSON.stringify(metadata[manifest.paperId])) !== status.metadataSha256) throw new Error('Published title metadata changed');
  return true;
}
