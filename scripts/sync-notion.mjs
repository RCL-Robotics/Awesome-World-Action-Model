#!/usr/bin/env node
import { open, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { PUBLIC_FIELDS, applyClassificationOverrides, atomicWriteFiles, coverage, guardDecrease, mapNotionPage, mergeCatalogPapers, migrateLegacyCatalog, planCatalogUpdate, readJson, sortPapers, validateClassificationOverrides, validatePapers } from './lib/data.mjs';
import { createNotionReader, queryAllPages, validateSourceId } from './lib/notion.mjs';
import { privateSnapshotPath } from './lib/paths.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const help = `Export the paper catalog from Notion (read-only).

Usage: node scripts/sync-notion.mjs [options]
  --cli                    Use the locally authenticated ntn CLI
  --input <snapshot.json>   Map a complete local Notion snapshot, without network access
  --source <UUID>           Override NOTION_DATA_SOURCE_ID (never saved to catalog data)
  --snapshot <path>         Save the raw snapshot outside this repository for private auditing
  --check / --dry-run       Fetch, map, and validate without writing files
  --allow-large-decrease   Explicitly allow a paper-count decrease of more than 20%
  --allow-empty            Explicitly allow an empty catalog (normally rejected)
  --help                   Show this help

Default authentication: NOTION_API_TOKEN. Source: NOTION_DATA_SOURCE_ID.
Use a read-only Notion integration with access only to the intended database.
NOTION_API_VERSION may override the default supported API version.
Optional data/local-papers.json is preserved and merged; Notion wins matching IDs.
After an accepted sync, run npm run generate:readme and review the Git diff.
`;

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--input', '--source', '--snapshot'].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = args[++i];
    } else if (['--cli', '--check', '--dry-run', '--allow-large-decrease', '--allow-empty', '--help'].includes(arg)) options[arg.slice(2)] = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.input && options.cli) throw new Error('Choose either --input or --cli.');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(help); return; }
  const dryRun = options.check || options['dry-run'];
  const allowEmpty = Boolean(options['allow-empty']);
  const allowLargeDecrease = Boolean(options['allow-large-decrease']);
  const snapshotPath = options.snapshot ? await privateSnapshotPath(options.snapshot, ROOT) : null;
  const papersPath = resolve(ROOT, 'data/papers.json');
  const metaPath = resolve(ROOT, 'data/meta.json');
  const lockPath = resolve(ROOT, 'data/.sync.lock');
  let lock;
  try {
    if (!dryRun) {
      await mkdir(dirname(lockPath), { recursive: true });
      try { lock = await open(lockPath, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('Another sync holds data/.sync.lock. Wait for it, or remove the lock only after confirming no sync is running.'); throw error; }
      await lock.writeFile(String(process.pid));
    }
    let previous = [];
    let needsSchemaMigration = false;
    try {
      const existing = await readJson(papersPath);
      previous = migrateLegacyCatalog(existing);
      needsSchemaMigration = existing.some((paper) => Object.keys(paper).length !== PUBLIC_FIELDS.length);
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let previousMeta;
    try { previousMeta = await readJson(metaPath); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    let localPapers = [];
    try { localPapers = await readJson(resolve(ROOT, 'data/local-papers.json')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (previousMeta?.source === 'Notion + arXiv discovery') throw new Error('Missing data/local-papers.json for a mixed-source catalog; restore the local overlay before syncing.');
    }
    validatePapers(localPapers, { allowEmpty: true });
    let classificationOverrides;
    try { classificationOverrides = validateClassificationOverrides(await readJson(resolve(ROOT, 'data/classification-overrides.json'))); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (previous.some(paper => paper.majorCategory === 'WAM Components')) throw new Error('Missing data/classification-overrides.json; restore the category reviews before syncing.');
    }
    let snapshot;
    if (options.input) {
      const input = await readJson(resolve(options.input));
      if (!Array.isArray(input) && (input.has_more === true || input.request_status?.type === 'incomplete')) throw new Error('Input snapshot is incomplete; provide all pagination results.');
      snapshot = Array.isArray(input) ? { results: input, fetchedAt: new Date().toISOString() } : input;
      if (!Array.isArray(snapshot.results)) throw new Error('Input must be an array of Notion pages or a complete snapshot with a results array.');
    } else {
      const source = validateSourceId(options.source ?? process.env.NOTION_DATA_SOURCE_ID);
      const reader = createNotionReader({ cli: Boolean(options.cli) });
      const results = await queryAllPages(reader, source);
      snapshot = { fetchedAt: new Date().toISOString(), results, has_more: false };
    }
    const notionPapers = sortPapers(snapshot.results.map(mapNotionPage));
    validatePapers(notionPapers, { allowEmpty });
    // The merged count must not hide a truncated Notion export. Records whose
    // IDs are absent from the overlay provide a known Notion-only baseline.
    const localIds = new Set(localPapers.map(paper => paper.id));
    guardDecrease(previous.filter(paper => !localIds.has(paper.id)).length, notionPapers.length, { allowEmpty, allowLargeDecrease });
    const merged = mergeCatalogPapers(notionPapers, localPapers);
    const papers = classificationOverrides ? applyClassificationOverrides(merged.papers, classificationOverrides) : merged.papers;
    const source = merged.source;
    guardDecrease(previous.length, papers.length, { allowEmpty, allowLargeDecrease });
    const update = planCatalogUpdate(papers, previous, previousMeta, snapshot.fetchedAt ?? new Date().toISOString(), source);
    const changed = update.changed || needsSchemaMigration;
    const meta = update.meta;
    const summary = coverage(papers);
    console.log(`${dryRun ? 'Validated (no files written)' : 'Validated'}: ${summary.papers} papers (${summary.arxiv} arXiv, ${summary.nonArxiv} other); code ${summary.code}, projects ${summary.project}, PDFs ${summary.pdf}, DOIs ${summary.doi}, venues ${summary.venue}.`);
    console.log(`Recorded years ${summary.publicationYear}, BibTeX ${summary.bibtex}; uncategorized ${summary.uncategorized}, missing dates ${summary.unknownDate}, missing abstracts ${summary.missingAbstract}.`);
    console.log(`Classification coverage: major ${summary.majorCategory}, subcategories ${summary.subcategories}, architecture ${summary.architecture}, prediction paradigm ${summary.predictionParadigm}, quadrant ${summary.quadrant}, status ${summary.classificationStatus}.`);
    console.log(`Quadrants: ${JSON.stringify(summary.quadrantDistribution)}.`);
    if (needsSchemaMigration) console.log('Legacy catalog will be migrated to the current catalog schema.');
    if (!changed) console.log('No catalog changes.');
    if (dryRun) return;
    const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
    const files = changed ? [[papersPath, json(papers)], [metaPath, json(meta)]] : [];
    if (snapshotPath) files.push([snapshotPath, json(snapshot)]);
    await atomicWriteFiles(files);
    if (changed) console.log('Updated data/papers.json and data/meta.json. Run npm run generate:readme and review the diff.');
  } finally {
    if (lock) { await lock.close(); await unlink(lockPath); }
  }
}

main().catch((error) => { console.error(`Sync aborted: ${error.message}`); process.exitCode = 1; });
