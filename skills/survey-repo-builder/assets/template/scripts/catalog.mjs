#!/usr/bin/env node
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSource, compact, safeUrl, validateConfig, validatePapers } from '../lib/catalog.mjs';
import { parseBibtex } from '../lib/bibtex.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function loadProject(directory = root) {
  const config = validateConfig(JSON.parse(await readFile(resolve(directory, 'survey.config.json'), 'utf8')));
  const papers = validatePapers(JSON.parse(await readFile(resolve(directory, 'data/papers.json'), 'utf8')), config);
  for (const figure of config.figures) if (!(await lstat(resolve(directory, 'public', figure.src.slice(1)))).isFile()) throw new Error(`Figure must be a regular image file: ${figure.src}`);
  return { config, papers };
}
const defaults = { authors: [], year: null, date: null, categories: [], tags: [], abstract: '', summary: '', bibtex: '', codeUrl: null, projectUrl: null };
const fields = new Set(['id', 'title', 'url', 'priority', ...Object.keys(defaults)]);
export function planImport(existing, incoming, config, update = false) {
  if (!Array.isArray(incoming)) throw new Error('Import input must be an array.');
  const papers = structuredClone(existing), added = [], duplicates = [], updated = [], conflicts = [], warnings = [];
  const batchSources = new Set();
  for (const raw of incoming) {
    if (!raw || Object.keys(raw).some(key => !fields.has(key))) throw new Error('Import contains unsupported fields; map the source to the public paper contract first.');
    if (!safeUrl(raw.url)) throw new Error(`Missing or invalid source URL: ${raw.title || raw.id || 'record'}`);
    const source = canonicalSource(raw.url);
    if (batchSources.has(source)) { conflicts.push({ title: raw.title, reason: 'Source occurs more than once in the import batch.' }); continue; }
    batchSources.add(source);
    const id = raw.id || 'paper-' + createHash('sha256').update(source).digest('hex').slice(0, 20);
    const byId = papers.find(p => p.id === id), bySource = papers.find(p => canonicalSource(p.url) === source);
    if (byId && canonicalSource(byId.url) !== source) { conflicts.push({ id, reason: 'Existing ID identifies a different source. Resolve the identity before importing.' }); continue; }
    const match = bySource || byId;
    if (match) {
      const proposed = { ...match, ...raw, id: match.id };
      validatePapers([proposed], config);
      const changed = Object.keys(proposed).filter(key => JSON.stringify(match[key]) !== JSON.stringify(proposed[key]));
      if (changed.length && update) { Object.assign(match, proposed); updated.push({ id: match.id, title: match.title, fields: changed }); }
      else duplicates.push({ id: match.id, title: match.title, differingFields: changed });
      continue;
    }
    const paper = { ...structuredClone(defaults), ...raw, id };
    validatePapers([paper], config);
    const sameTitle = papers.find(p => compact(p.title) === compact(paper.title));
    if (sameTitle) { conflicts.push({ id, title: paper.title, existingId: sameTitle.id, reason: 'Same normalized title with a different source; check whether this is another edition of the same paper.' }); continue; }
    if (!paper.categories.length) warnings.push({ id, reason: 'No category supplied; retained as unassigned.' });
    papers.push(paper); added.push({ id, title: paper.title });
  }
  validatePapers(papers, config);
  return { papers, report: { added, duplicates, updated, conflicts, warnings } };
}
export async function atomicJson(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  try { await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); await rename(temp, path); }
  finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { config, papers } = await loadProject();
    const [command, ...args] = process.argv.slice(2);
    if (command === 'validate') console.log(`Valid catalog: ${papers.length} papers, ${config.categories.length} categories.`);
    else if (command === 'import') {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (['--apply', '--update'].includes(args[i])) options[args[i]] = true;
        else if (['--input', '--format'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i]] = args[++i];
        else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
      }
      if (!options['--input'] || !['json', 'bibtex'].includes(options['--format'] || 'json')) throw new Error('Use import --input FILE --format json|bibtex [--update] [--apply].');
      const input = await readFile(resolve(options['--input']), 'utf8');
      const records = options['--format'] === 'bibtex' ? parseBibtex(input) : JSON.parse(input);
      const planned = planImport(papers, records, config, Boolean(options['--update']));
      console.log(JSON.stringify({ mode: options['--apply'] ? 'apply' : 'preview', ...planned.report }, null, 2));
      if (planned.report.conflicts.length) throw new Error('Unresolved conflicts; catalog has not been written.');
      if (options['--apply']) await atomicJson(resolve(root, 'data/papers.json'), planned.papers);
    } else throw new Error('Use validate or import --input FILE [--format json|bibtex] [--update] [--apply].');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
