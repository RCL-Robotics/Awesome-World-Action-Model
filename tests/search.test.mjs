import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPapers } from '../src/lib/search.mjs';

const make = (id, overrides = {}) => ({ id, title: 'World model', authors: 'José García', affiliations: 'Research lab', contribution: 'Planning from pixels', abstract: 'Predictive control with latent dynamics.', bibtexKey: 'Model', bibtex: '', submittedDate: '2026-08-10', publicationYear: null, paperUrl: `https://arxiv.org/abs/${id}`, arxivUrl: `https://arxiv.org/abs/${id}`, pdfUrl: null, doi: null, venue: null, primaryCategory: 'Memory WAM', secondaryCategories: ['WAM + RL'], codeUrls: [], ...overrides });
const collection = [make('2608.00002'), make('2609.00001', { title: 'Action transformer', submittedDate: '2026-09-02', primaryCategory: '3D/4D WAM', codeUrls: ['https://github.com/example/model'] }), make('2608.00001', { title: 'Visual navigation', abstract: 'This model studies tactile control.' })];
test('search supports accents, multiword matching, abstracts and arXiv IDs', () => {
  assert.equal(filterPapers(collection, { query: 'jose planning' }).length, 3);
  assert.deepEqual(filterPapers(collection, { query: 'tactile' }).map(p => p.id), ['2608.00001']);
  assert.equal(filterPapers(collection, { query: '2609.00001' })[0].title, 'Action transformer');
});
test('primary, secondary, date and code constraints combine', () => {
  assert.equal(filterPapers(collection, { category: '3D/4D WAM', secondary: 'WAM + RL', month: '2026-09', code: true }).length, 1);
  assert.equal(filterPapers(collection, { category: 'Memory WAM', code: true }).length, 0);
  assert.equal(filterPapers(collection, { secondary: 'General WAM' }).length, 0);
});
test('sorting is deterministic and leaves source order intact', () => {
  assert.deepEqual(filterPapers(collection, {}).map(p => p.id), ['2609.00001', '2608.00002', '2608.00001']);
  assert.equal(filterPapers(collection, { sort: 'oldest' })[0].id, '2608.00001');
  assert.equal(filterPapers(collection, { sort: 'title' })[0].title, 'Action transformer');
  assert.equal(collection[0].id, '2608.00002');
});

test('chronological sorting combines recorded dates and years, keeping unknown records last', () => {
  const mixed = [
    make('unknown', { submittedDate: null, title: 'An undated paper' }),
    make('year-2026', { submittedDate: null, publicationYear: 2026 }),
    make('year-1989', { submittedDate: null, publicationYear: 1989 }),
    make('dated-2026'),
  ];
  assert.deepEqual(filterPapers(mixed, {}).map(p => p.id), ['dated-2026', 'year-2026', 'year-1989', 'unknown']);
  assert.deepEqual(filterPapers(mixed, { sort: 'oldest' }).map(p => p.id), ['year-1989', 'dated-2026', 'year-2026', 'unknown']);
  assert.equal(filterPapers(mixed, { sort: 'title' })[0].id, 'unknown');
  assert.equal(mixed[0].submittedDate, null);
});

test('month filters tolerate missing dates and publication-year filters use only recorded years', () => {
  const mixed = [make('dated'), make('year-only', { submittedDate: null, publicationYear: 2026, primaryCategory: 'Uncategorized', abstract: '' }), make('no-date', { submittedDate: null, primaryCategory: 'Uncategorized', abstract: '' })];
  assert.deepEqual(filterPapers(mixed, { month: '2026-08' }).map(p => p.id), ['dated']);
  assert.deepEqual(filterPapers(mixed, { year: '2026' }).map(p => p.id), ['year-only']);
  assert.equal(filterPapers(mixed, { year: '2026', month: '2026-08' }).length, 0);
  assert.equal(filterPapers(mixed, { category: 'Uncategorized' }).length, 2);
  assert.equal(filterPapers(mixed, {}).length, 3);
});

test('non-arXiv records are searchable by paper URL, PDF URL, DOI, venue, and BibTeX', () => {
  const record = make('ref-example', { arxivUrl: null, submittedDate: null, publicationYear: 2022, paperUrl: 'https://openreview.net/forum?id=example123', pdfUrl: 'https://proceedings.example.org/paper/goal.pdf', doi: 'https://doi.org/10.1234/goal.2022', venue: 'Learning Conference', bibtex: '@inproceedings{UniqueCitation2022, title={World model}}', primaryCategory: 'Uncategorized', contribution: '', abstract: '' });
  for (const query of ['openreview.net/forum?id=example123', 'goal.pdf', '10.1234/goal.2022', 'learning conference', 'UniqueCitation2022']) {
    assert.deepEqual(filterPapers([record], { query }).map(p => p.id), ['ref-example']);
  }
});
