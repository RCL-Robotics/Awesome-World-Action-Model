import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPapers } from '../src/lib/search.mjs';
import { MAJOR_CATEGORIES, QUADRANTS, QUADRANT_STATUSES } from '../src/lib/taxonomy.mjs';

const make = (id, overrides = {}) => ({ id, title: 'World model', authors: 'José García', affiliations: 'Research lab', contribution: 'Planning from pixels', abstract: 'Predictive control with latent dynamics.', bibtexKey: 'Model', bibtex: '', submittedDate: '2026-08-10', publicationYear: null, paperUrl: `https://arxiv.org/abs/${id}`, arxivUrl: `https://arxiv.org/abs/${id}`, pdfUrl: null, doi: null, venue: null, primaryCategory: 'Memory WAM', secondaryCategories: ['WAM + RL'], codeUrls: [], majorCategory: null, subcategories: [], architecture: null, predictionParadigm: null, quadrant: null, classificationStatus: null, ...overrides });
const collection = [make('2608.00002'), make('2609.00001', { title: 'Action transformer', submittedDate: '2026-09-02', primaryCategory: '3D/4D WAM', codeUrls: ['https://github.com/example/model'] }), make('2608.00001', { title: 'Visual navigation', abstract: 'This model studies tactile control.' })];
test('search supports accents, multiword matching, abstracts and arXiv IDs', () => {
  assert.equal(filterPapers(collection, { query: 'jose planning' }).length, 3);
  assert.deepEqual(filterPapers(collection, { query: 'tactile' }).map(p => p.id), ['2608.00001']);
  assert.equal(filterPapers(collection, { query: '2609.00001' })[0].title, 'Action transformer');
});
test('paper names ignore case, spaces, hyphens, full-width text and invisible copy artifacts', () => {
  const records = [make('fast', { title: 'Fast-WAM: Efficient control' }), make('other', { title: 'Slow control' })];
  for (const query of ['fastwam', 'FASTWAM', 'Fast WAM', '  fAsT\t\nWaM  ', 'Fast\u00a0WAM', 'Fast—WAM', 'Fast_WAM', 'ＦＡＳＴ ＷＡＭ', 'Fast\u200bWAM', 'Fast\u00adWAM']) {
    assert.deepEqual(filterPapers(records, { query }).map(p => p.id), ['fast'], query);
  }
});
test('compact queries match spaced names and author names in the source', () => {
  const records = [make('spaced', { title: 'World Model', authors: 'José García' }), make('compact', { title: 'WorldModel', authors: 'Other Author' })];
  for (const query of ['worldmodel', 'WORLD MODEL', 'world-model']) {
    assert.deepEqual(filterPapers(records, { query, sort: 'title' }).map(p => p.id).sort(), ['compact', 'spaced']);
  }
  assert.deepEqual(filterPapers(records, { query: 'JOSEGARCIA' }).map(p => p.id), ['spaced']);
  assert.deepEqual(filterPapers([make('copied', { title: 'Fast\u200b—\u00a0WAM' })], { query: 'fastwam' }).map(p => p.id), ['copied']);
});
test('keywords can match different fields without inventing compact names across fields', () => {
  const records = [make('separate', { title: 'Inter', authors: 'Stellar' })];
  assert.equal(filterPapers(records, { query: 'interstellar' }).length, 0);
  assert.equal(filterPapers(records, { query: 'STELLAR inter' }).length, 1);
  assert.equal(filterPapers(records, { query: 'stellar missingword' }).length, 0);
  assert.equal(filterPapers(records, { query: ' \t\n\u00a0 ' }).length, 1);
});
test('normalized name searches still respect selected quadrants', () => {
  const records = [make('fast', { title: 'Fast-WAM', quadrant: QUADRANTS[0] }), make('other', { title: 'Slow model', quadrant: QUADRANTS[3] })];
  assert.equal(filterPapers(records, { query: 'FASTWAM', quadrant: QUADRANTS[3] }).length, 0);
  assert.deepEqual(filterPapers(records, { query: 'FASTWAM' }).map(p => p.id), ['fast']);
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

test('major category, quadrant, and multi-value subtype combine with the original filters', () => {
  const shared = { majorCategory: MAJOR_CATEGORIES[2], subcategories: ['视觉规划与IDM', '记忆与长时序'], quadrant: QUADRANTS[0], publicationYear: 2026, codeUrls: ['https://github.com/example/model'] };
  const records = [make('target', shared), make('other-quadrant', { ...shared, quadrant: QUADRANTS[1] }), make('other-major', { ...shared, majorCategory: MAJOR_CATEGORIES[1] })];
  const filters = { query: 'jose planning', major: MAJOR_CATEGORIES[2], quadrant: QUADRANTS[0], subtype: '记忆与长时序', category: 'Memory WAM', secondary: 'WAM + RL', year: '2026', month: '2026-08', code: true };
  assert.deepEqual(filterPapers(records, filters).map(p => p.id), ['target']);
  assert.equal(filterPapers(records, { ...filters, subtype: '导航' }).length, 0);
  assert.equal(filterPapers(records, { ...filters, category: 'General WAM' }).length, 0);
});

test('unassigned classification is distinct from recorded quadrant statuses', () => {
  const records = [make('unassigned'), make('pending', { majorCategory: MAJOR_CATEGORIES[2], quadrant: QUADRANT_STATUSES[6], subcategories: ['理论与规划'] }), make('not-applicable', { majorCategory: MAJOR_CATEGORIES[0], quadrant: QUADRANT_STATUSES[5] })];
  assert.equal(filterPapers(records, {}).length, 3);
  assert.deepEqual(filterPapers(records, { major: '__unassigned__', quadrant: '__unassigned__', subtype: '__unassigned__' }).map(p => p.id), ['unassigned']);
  assert.deepEqual(filterPapers(records, { quadrant: QUADRANT_STATUSES[6] }).map(p => p.id), ['pending']);
  assert.deepEqual(filterPapers(records, { quadrant: QUADRANT_STATUSES[5] }).map(p => p.id), ['not-applicable']);
});

test('taxonomy labels, both axes, and review status are searchable without requiring an abstract', () => {
  const record = make('classified', { abstract: '', contribution: '', majorCategory: MAJOR_CATEGORIES[2], subcategories: ['潜空间预测与JEPA'], quadrant: QUADRANTS[0], architecture: 'One Model', predictionParadigm: '联合预测', classificationStatus: '一手资料核实' });
  assert.deepEqual(filterPapers([record], { query: 'WAM JEPA One Model 联合预测 一手资料核实 Q1' }).map(p => p.id), ['classified']);
  assert.equal(filterPapers([record, make('empty')], { query: '不适用' }).length, 0);
});

test('English taxonomy queries match translated labels while filters retain their source values', () => {
  const record = make('translated', { title: 'Reference entry', authors: 'A. Reader', abstract: '', contribution: '', majorCategory: MAJOR_CATEGORIES[0], subcategories: ['潜空间预测与JEPA'], quadrant: QUADRANTS[0], architecture: 'One Model', predictionParadigm: '联合预测', classificationStatus: '一手资料核实' });
  const filters = { query: 'foundational latent joint prediction verified primary sources', major: MAJOR_CATEGORIES[0], quadrant: QUADRANTS[0], subtype: '潜空间预测与JEPA' };
  assert.deepEqual(filterPapers([record, make('other')], filters).map(p => p.id), ['translated']);
  assert.equal(record.majorCategory, MAJOR_CATEGORIES[0]);
  assert.equal(filterPapers([record], { ...filters, major: 'Foundational work' }).length, 0);
});

test('English venue annotations are searchable without changing the stored venue', () => {
  const record = make('book', { venue: 'MIT Press（图书，第一版）' });
  assert.deepEqual(filterPapers([record, make('other')], { query: 'book first edition' }).map(p => p.id), ['book']);
  assert.equal(record.venue, 'MIT Press（图书，第一版）');
});
