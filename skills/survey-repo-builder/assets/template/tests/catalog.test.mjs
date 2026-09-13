import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig, validatePapers, filterPapers } from '../lib/catalog.mjs';
import { planImport } from '../scripts/catalog.mjs';
import { parseBibtex } from '../lib/bibtex.mjs';
const config = validateConfig(JSON.parse(await readFile(new URL('../survey.config.json', import.meta.url), 'utf8')));
const paper = (id, extra = {}) => ({ id, title: id, authors: [], url: `https://example.org/${id}`, year: null, date: null, categories: [], tags: [], abstract: '', summary: '', bibtex: '', codeUrl: null, projectUrl: null, ...extra });
test('project catalog follows its own configured categories', async () => {
  const papers = JSON.parse(await readFile(new URL('../data/papers.json', import.meta.url), 'utf8'));
  assert.equal(validatePapers(papers, config), papers);
  assert.throws(() => validatePapers([paper('bad', { categories: ['__invalid_category__'] })], config), /category/);
  assert.throws(() => validatePapers([paper('bad', { url: 'javascript:alert(1)' })], config), /identity/);
});
test('name search prioritizes the paper over later mentions and unknown dates remain last', () => {
  const entries = [paper('mention', { title: 'Benchmark', summary: 'Uses CompactLearn', year: 2024 }), paper('target', { title: 'Compact-Learn', year: 2022 }), paper('unknown')];
  assert.equal(filterPapers(entries, config, { query: 'Compact Learn' })[0].id, 'target');
  assert.deepEqual(filterPapers(entries, config, { sort: 'newest' }).map(p => p.id), ['mention', 'target', 'unknown']);
});
test('import recognizes arXiv revisions and preserves unspecified fields in explicit updates', () => {
  const old = paper('stable', { title: 'Verified title', url: 'https://arxiv.org/abs/2401.12345', summary: 'Keep this note', year: 2024 });
  const incoming = [{ title: 'Corrected title', url: 'https://arxiv.org/pdf/2401.12345v2' }];
  const preview = planImport([old], incoming, config);
  assert.equal(preview.report.added.length, 0); assert.deepEqual(preview.papers, [old]);
  const update = planImport([old], incoming, config, true);
  assert.equal(update.papers[0].id, 'stable'); assert.equal(update.papers[0].summary, 'Keep this note'); assert.equal(update.papers[0].year, 2024); assert.equal(update.papers[0].title, 'Corrected title');
});
test('identity conflicts are explicit and no input records are mutated', () => {
  const old = paper('stable', { title: 'Same title' });
  const before = structuredClone(old);
  assert.equal(planImport([old], [{ title: 'Same title', url: 'https://example.org/different' }], config).report.conflicts.length, 1);
  assert.equal(planImport([old], [{ id: 'stable', title: 'Different paper', url: 'https://example.org/different' }], config).report.conflicts.length, 1);
  assert.deepEqual(old, before);
});
test('BibTeX supports nested titles and corporate authors without silently accepting macros', () => {
  const parsed = parseBibtex('@article{sample, title={A {Nested} Title}, author={{Research and Development Team} and Doe, Jane}, year=2022, doi={10.1234/example}}');
  assert.equal(parsed[0].title, 'A Nested Title'); assert.deepEqual(parsed[0].authors, ['Research and Development Team', 'Doe, Jane']); assert.equal(parsed[0].url, 'https://doi.org/10.1234/example');
  assert.throws(() => parseBibtex('@article{bad,title=macro,url={https://example.org}}'), /macros/);
  assert.throws(() => parseBibtex('@article{bad,title={one} # {two},url={https://example.org}}'), /concatenated/);
});
