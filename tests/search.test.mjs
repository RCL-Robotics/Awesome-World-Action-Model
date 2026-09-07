import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPapers } from '../src/lib/search.mjs';

const make = (id, overrides = {}) => ({ id, title: 'World model', authors: 'José García', affiliations: 'Research lab', contribution: 'Planning from pixels', abstract: 'Predictive control with latent dynamics.', bibtexKey: 'Model', submittedDate: '2026-08-10', primaryCategory: 'Memory WAM', secondaryCategories: ['WAM + RL'], codeUrls: [], ...overrides });
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
