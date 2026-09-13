import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, LEGACY_PUBLIC_FIELDS, REFERENCE_PUBLIC_FIELDS, PUBLIC_FIELDS, applyClassificationOverrides, validateClassificationOverrides, arxivIdentity, atomicWriteFiles, buildMeta, guardDecrease, mapNotionPage, mergeCatalogPapers, migrateLegacyCatalog, normalizeDoi, paperIdentity, planCatalogUpdate, propertyUrls, sortPapers, validateMeta, validatePapers } from '../scripts/lib/data.mjs';
import { createNotionReader, paginate, queryAllPages, withRetry } from '../scripts/lib/notion.mjs';
import { privateSnapshotPath } from '../scripts/lib/paths.mjs';
import { QUADRANTS, QUADRANT_AXES } from '../src/lib/taxonomy.mjs';

const SOURCE = '00000000-0000-4000-8000-000000000001';
const PAGE = '00000000-0000-4000-8000-000000000002';
const text = (value) => ({ plain_text: value, text: { content: value } });
const rich = (...values) => ({ type: 'rich_text', rich_text: values.map(text) });
const select = (name) => ({ type: 'select', select: name === null ? null : { name } });
async function copyImportRuntime(repository) {
  await cp(new URL('../scripts/', import.meta.url), join(repository, 'scripts'), { recursive: true });
  await mkdir(join(repository, 'src/lib'), { recursive: true });
  await cp(new URL('../src/lib/taxonomy.mjs', import.meta.url), join(repository, 'src/lib/taxonomy.mjs'));
}
function fixture() {
  return {
    object: 'page', id: PAGE, archived: false, created_by: { id: 'private-user', person: { email: 'private@example.test' } },
    properties: {
      'Paper Name': { type: 'title', title: [text('Test world action model')] },
      'Paper URL': { type: 'url', url: 'https://arxiv.org/abs/2605.12345v2' },
      Authors: rich('First Author; ', 'Second Author'),
      'Author Affiliations': rich('Example University'),
      Contribution: rich('Predict actions.'),
      'English Abstract': rich('A world model abstract.'),
      'Submitted Date': { type: 'date', date: { start: '2026-05-04' } },
      'Primary Category': { type: 'select', select: { name: 'General WAM' } },
      'Secondary Categories': { type: 'multi_select', multi_select: [{ name: 'None' }] },
      'BibTeX Key': rich('example2026'),
      'Code URL': rich(),
      'Web Page': { type: 'url', url: null },
      '论文收录': rich(),
      'Private Notes': rich('This must never be published.'),
    },
  };
}
function paper() { return mapNotionPage(fixture()); }
function componentReview() {
  return { schemaVersion: 1, reviewedAt: '2026-09-11T10:00:00.000Z', entries: [{ paperId: paper().id,
    componentArea: 'Visual encoders & representations', reason: 'Reusable image embeddings for downstream policies.',
    evidenceIds: ['e1'], reportSha256: 'a'.repeat(64) }] };
}

function categoryReview(classification = { majorCategory: 'WAM', subcategories: ['三维表示与状态估计'], architecture: 'Dual-system', predictionParadigm: '其他机制', quadrant: '四象限外' }) {
  return { schemaVersion: 2, reviewedAt: '2026-09-13T10:00:00.000Z', entries: [{ paperId: paper().id,
    classification, reason: 'Separate policy and dynamics networks define a specialized predictive-control system.',
    evidenceIds: ['e-method'], reportSha256: 'b'.repeat(64),
    ...(classification.majorCategory === '奠基性工作' ? { firstPublicationYear: 2024 } : {}) }] };
}

test('category reviews correct major and evidenced axes without changing bibliography or source-review status', () => {
  const original = { ...paper(), majorCategory: '奠基性工作', subcategories: ['神经世界模拟器'], architecture: '不适用', predictionParadigm: '不适用', quadrant: '不适用', classificationStatus: '部分待核实' };
  const saved = structuredClone(original);
  const review = categoryReview();
  const result = applyClassificationOverrides([original], review);
  assert.deepEqual(result, [{ ...original, ...review.entries[0].classification }]);
  assert.deepEqual(original, saved);
  assert.deepEqual(applyClassificationOverrides(result, review), result);
  assert.deepEqual(applyClassificationOverrides([], review), []);
  const categoryOnly = categoryReview({ majorCategory: 'Related resources', subcategories: ['综述与技术资源'] });
  assert.equal(applyClassificationOverrides([original], categoryOnly)[0].architecture, original.architecture);
});

test('curated categories reject unreviewed additions and post-2025 foundations', () => {
  const original = { ...paper(), majorCategory: '奠基性工作' };
  const empty = { ...categoryReview(), entries: [] };
  assert.throws(() => applyClassificationOverrides([original], empty), /explicit scope review/);
  assert.throws(() => applyClassificationOverrides([{ ...original, majorCategory: 'WAM Components' }], empty), /explicit scope review/);
  const foundational = categoryReview({ majorCategory: '奠基性工作', subcategories: ['理论与规划'] });
  assert.equal(applyClassificationOverrides([original], foundational)[0].majorCategory, '奠基性工作');
  foundational.entries[0].firstPublicationYear = 2026;
  assert.throws(() => validateClassificationOverrides(foundational), /before 2026/);
  const inconsistent = categoryReview();
  inconsistent.entries[0].classification.quadrant = QUADRANTS[0];
  assert.throws(() => validateClassificationOverrides(inconsistent), /Inconsistent quadrant/);
  const privateField = categoryReview();
  privateField.entries[0].classification.privateNotes = 'private';
  assert.throws(() => validateClassificationOverrides(privateField), /Invalid classification fields/);
});

test('offline Notion sync retains corrected categories while updating source bibliography', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-category-v2-sync-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const reviews = categoryReview();
    await writeFile(join(repository, 'data/classification-overrides.json'), JSON.stringify(reviews));
    const source = fixture();
    source.properties['大类'] = select('奠基性工作');
    const inputPath = join(dir, 'input.json');
    const sync = () => execFileSync(process.execPath, [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    await writeFile(inputPath, JSON.stringify({ results: [source], fetchedAt: '2026-09-13T10:00:00.000Z' }));
    sync();
    source.properties['Paper Name'].title = [text('A corrected source title')];
    await writeFile(inputPath, JSON.stringify({ results: [source], fetchedAt: '2026-09-13T11:00:00.000Z' }));
    sync();
    const actual = JSON.parse(await readFile(join(repository, 'data/papers.json'), 'utf8'));
    assert.deepEqual(actual, applyClassificationOverrides([mapNotionPage(source)], reviews));
    assert.equal(actual[0].title, 'A corrected source title');
    assert.equal(actual[0].majorCategory, 'WAM');
    assert.equal(actual[0].architecture, 'Dual-system');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('component reviews preserve source fields, avoid duplicate translated subtypes and never resurrect deleted papers', () => {
  const original = { ...paper(), majorCategory: '奠基性工作', subcategories: ['视觉编码器与表征', '视觉表征迁移基准'], quadrant: '不适用', classificationStatus: '部分待核实' };
  const before = structuredClone(original);
  const result = applyClassificationOverrides([original], componentReview());
  assert.deepEqual(result, [{ ...original, majorCategory: 'WAM Components', subcategories: ['视觉编码器与表征', '视觉表征迁移基准'] }]);
  assert.deepEqual(original, before);
  validatePapers(result);
  assert.deepEqual(applyClassificationOverrides(result, componentReview()), result);
  assert.deepEqual(applyClassificationOverrides([], componentReview()), []);
  const unrelated = mapNotionPage(referenceFixture());
  assert.deepEqual(applyClassificationOverrides([unrelated], componentReview()), [unrelated]);
});

test('component reviews reject duplicate identities, unsupported fields and malformed evidence', () => {
  const valid = componentReview();
  assert.throws(() => validateClassificationOverrides({ ...valid, privatePath: '/private/review' }), /exactly/);
  assert.throws(() => validateClassificationOverrides({ ...valid, entries: [valid.entries[0], valid.entries[0]] }), /Duplicate/);
  for (const patch of [{ componentArea: 'guess' }, { reason: '' }, { evidenceIds: [] }, { evidenceIds: ['e1', 'e1'] }, { reportSha256: 'bad' }, { paperId: '../outside' }, { classificationStatus: '一手资料核实' }]) {
    assert.throws(() => validateClassificationOverrides({ ...valid, entries: [{ ...valid.entries[0], ...patch }] }));
  }
});

test('offline Notion sync reapplies component reviews while accepting bibliographic updates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-classification-sync-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const papersPath = join(repository, 'data/papers.json');
    const metaPath = join(repository, 'data/meta.json');
    const reviewPath = join(repository, 'data/classification-overrides.json');
    const inputPath = join(dir, 'input.json');
    const reviews = componentReview();
    const reviewBytes = JSON.stringify(reviews);
    await writeFile(reviewPath, reviewBytes);
    const notion = fixture();
    notion.properties['大类'] = select('奠基性工作');
    notion.properties['Paper Name'].title = [text('Updated encoder title')];
    notion.properties['分类状态'] = select('部分待核实');
    await writeFile(inputPath, JSON.stringify({ results: [notion], fetchedAt: '2026-09-11T10:00:00.000Z' }));
    const sync = () => execFileSync(process.execPath, [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    assert.match(sync(), /Updated data/);
    const expected = applyClassificationOverrides([mapNotionPage(notion)], reviews);
    assert.deepEqual(JSON.parse(await readFile(papersPath, 'utf8')), expected);
    const stable = [await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')];
    assert.match(sync(), /No catalog changes/);
    assert.deepEqual([await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')], stable);
    assert.equal(await readFile(reviewPath, 'utf8'), reviewBytes);
    await rm(reviewPath);
    assert.throws(sync, /Missing data\/classification-overrides.json/);
    assert.deepEqual([await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')], stable);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
function referenceFixture() {
  const source = fixture();
  source.properties['Paper URL'].url = 'https://proceedings.example.org/2022/reference.html';
  source.properties['Submitted Date'].date = null;
  source.properties['Primary Category'].select = null;
  source.properties['English Abstract'] = rich();
  source.properties['Publication Year'] = { type: 'number', number: 2022 };
  source.properties['PDF URL'] = { type: 'url', url: 'https://proceedings.example.org/2022/reference.pdf' };
  source.properties.DOI = rich('https://doi.org/10.12345/example.2022');
  source.properties.BibTeX = rich('@inproceedings{reference2022,\n', '  title={Test world action model},\n  year={2022}\n}');
  return source;
}

test('mapping exports only the allowed fields and turns None/optional fields into empty values', () => {
  const actual = paper();
  assert.deepEqual(Object.keys(actual), PUBLIC_FIELDS);
  assert.deepEqual(actual.secondaryCategories, []);
  assert.deepEqual(actual.codeUrls, []);
  assert.equal(actual.projectUrl, null);
  assert.equal(actual.venue, null);
  assert.equal(actual.arxivUrl, 'https://arxiv.org/abs/2605.12345');
  assert.equal(actual.id, '2605.12345');
  assert.equal(actual.paperUrl, actual.arxivUrl);
  assert.equal(actual.publicationYear, null);
  assert.equal(actual.pdfUrl, null);
  assert.equal(actual.doi, null);
  assert.equal(actual.bibtex, '');
  assert.equal(PUBLIC_FIELDS.length, 25);
  for (const field of ['majorCategory', 'architecture', 'predictionParadigm', 'quadrant', 'classificationStatus']) assert.equal(actual[field], null);
  assert.deepEqual(actual.subcategories, []);
  assert.doesNotMatch(JSON.stringify(actual), /private|created_by/);
});

test('editorial taxonomy maps exact labels and excludes rationale, retrieval notes and the unrelated Date field', () => {
  const source = fixture();
  source.properties['大类'] = select('WAM');
  source.properties['小类'] = { type: 'multi_select', multi_select: [{ name: '联合视频动作建模' }, { name: '新增加的有效小类' }] };
  source.properties['架构类型'] = select('One Model');
  source.properties['预测范式'] = select('联合预测');
  source.properties['四象限'] = select('Q1 · One Model × 联合预测');
  source.properties['分类状态'] = select('一手资料核实');
  source.properties['分类依据'] = rich('Private rationale: /Users/private/research/notes.md');
  source.properties['检索记录'] = rich('Private retrieval history');
  source.properties.Date = { type: 'date', date: { start: '2000-01-01' } };
  const actual = mapNotionPage(source);
  assert.equal(actual.majorCategory, 'WAM');
  assert.deepEqual(actual.subcategories, ['联合视频动作建模', '新增加的有效小类']);
  assert.equal(actual.architecture, 'One Model');
  assert.equal(actual.predictionParadigm, '联合预测');
  assert.equal(actual.quadrant, 'Q1 · One Model × 联合预测');
  assert.equal(actual.classificationStatus, '一手资料核实');
  assert.equal(actual.submittedDate, '2026-05-04');
  assert.deepEqual(Object.keys(actual), PUBLIC_FIELDS);
  assert.doesNotMatch(JSON.stringify(actual), /Private rationale|\/Users\/private|retrieval history|分类依据|检索记录|2000-01-01/);
  validatePapers([actual]);
});

test('missing taxonomy values remain null or empty without inferring quadrants from their axes', () => {
  const source = fixture();
  for (const name of ['大类', '四象限', '分类状态']) source.properties[name] = select(null);
  source.properties['小类'] = { type: 'multi_select', multi_select: [] };
  source.properties['架构类型'] = select('Dual-system');
  source.properties['预测范式'] = select('IDM');
  const actual = mapNotionPage(source);
  assert.equal(actual.majorCategory, null);
  assert.equal(actual.classificationStatus, null);
  assert.deepEqual(actual.subcategories, []);
  assert.equal(actual.quadrant, null);
  assert.equal(actual.architecture, 'Dual-system');
  assert.equal(actual.predictionParadigm, 'IDM');
  validatePapers([actual]);
});

test('labeled Q1–Q4 entries must match both recorded axes, while non-quadrant statuses stay independent', () => {
  for (const quadrant of QUADRANTS) {
    const valid = { ...paper(), quadrant, ...QUADRANT_AXES[quadrant] };
    validatePapers([valid]);
    assert.throws(() => validatePapers([{ ...valid, architecture: null }]), /quadrant does not agree/);
    assert.throws(() => validatePapers([{ ...valid, predictionParadigm: valid.predictionParadigm === 'IDM' ? '联合预测' : 'IDM' }]), /quadrant does not agree/);
  }
  for (const quadrant of ['四象限外', '不适用', '待核实']) validatePapers([{ ...paper(), quadrant }]);
});

test('taxonomy validation rejects unknown select labels and malformed or duplicate subcategories', () => {
  for (const field of ['majorCategory', 'architecture', 'predictionParadigm', 'quadrant', 'classificationStatus']) assert.throws(() => validatePapers([{ ...paper(), [field]: 'invented label' }]), new RegExp(field));
  for (const subcategories of [[''], ['   '], [17], '小类']) assert.throws(() => validatePapers([{ ...paper(), subcategories }]), /nonempty strings/);
  assert.throws(() => validatePapers([{ ...paper(), subcategories: ['新类', '新类'] }]), /duplicate subcategory/);
  validatePapers([{ ...paper(), subcategories: ['任意后续新增小类'] }]);
  assert.throws(() => validatePapers([{ ...paper(), classificationRationale: 'private' }]), /exactly/);
});

test('unclassified references preserve supplied PDF, DOI, year and BibTeX without inventing missing metadata', () => {
  const actual = mapNotionPage(referenceFixture());
  assert.match(actual.id, /^ref-[0-9a-f]{20}$/);
  assert.equal(actual.arxivUrl, null);
  assert.equal(actual.paperUrl, 'https://proceedings.example.org/2022/reference.html');
  assert.equal(actual.submittedDate, null);
  assert.equal(actual.abstract, '');
  assert.equal(actual.primaryCategory, 'Uncategorized');
  assert.equal(actual.publicationYear, 2022);
  assert.equal(actual.pdfUrl, 'https://proceedings.example.org/2022/reference.pdf');
  assert.equal(actual.doi, 'https://doi.org/10.12345/example.2022');
  assert.equal(actual.bibtex, '@inproceedings{reference2022,\n  title={Test world action model},\n  year={2022}\n}');
  validatePapers([actual]);
});

test('reference IDs depend on normalized public URLs, not Notion identities or fragments', () => {
  const canonical = paperIdentity('https://example.org/paper?q=world');
  assert.deepEqual(paperIdentity('https://EXAMPLE.org:443/paper?q=world#abstract'), canonical);
  assert.notEqual(paperIdentity('https://example.org/another-paper?q=world').id, canonical.id);
  const first = referenceFixture();
  const second = referenceFixture();
  second.id = '00000000-0000-4000-8000-000000000099';
  assert.equal(mapNotionPage(first).id, mapNotionPage(second).id);
  assert.deepEqual(paperIdentity('https://arxiv.org/pdf/2605.12345v3.pdf#page=2'), { id: '2605.12345', arxivUrl: 'https://arxiv.org/abs/2605.12345', paperUrl: 'https://arxiv.org/abs/2605.12345' });
});

test('a PDF hosted by arXiv and a submitted date do not imply arxivUrl or publicationYear', () => {
  const source = referenceFixture();
  source.properties['PDF URL'].url = 'https://arxiv.org/pdf/2605.12345';
  source.properties['Submitted Date'].date = { start: '2026-05-04' };
  source.properties['Publication Year'].number = null;
  const actual = mapNotionPage(source);
  assert.equal(actual.arxivUrl, null);
  assert.equal(actual.publicationYear, null);
  assert.equal(actual.submittedDate, '2026-05-04');
  assert.equal(actual.pdfUrl, 'https://arxiv.org/pdf/2605.12345');
  validatePapers([actual]);
});

test('DOIs normalize to a standard HTTPS URL and reject unrelated or unsafe URLs', () => {
  assert.equal(normalizeDoi('doi:10.12345/Example'), 'https://doi.org/10.12345/Example');
  assert.equal(normalizeDoi('http://dx.doi.org/10.12345/Example'), 'https://doi.org/10.12345/Example');
  assert.equal(normalizeDoi(''), null);
  assert.throws(() => normalizeDoi('https://example.org/10.12345/Example'), /DOI/);
  assert.throws(() => normalizeDoi('javascript:alert(1)'), /HTTP/);
});

test('mixed-catalog sorting uses known dates or recorded years without manufacturing dates', () => {
  const dated = paper();
  const knownYear = { ...mapNotionPage(referenceFixture()), publicationYear: 2025, title: 'Known year' };
  const unknown = { ...mapNotionPage(referenceFixture()), publicationYear: null, title: 'Unknown date and year' };
  assert.deepEqual(sortPapers([unknown, knownYear, dated]).map((entry) => entry.title), [dated.title, knownYear.title, unknown.title]);
  assert.equal(knownYear.submittedDate, null);
  assert.equal(unknown.submittedDate, null);
  assert.deepEqual(buildMeta([unknown, dated, knownYear]).sourceDateRange, { start: '2026-05-04', end: '2026-05-04' });
  const unknownMeta = buildMeta([unknown, knownYear]);
  assert.deepEqual(unknownMeta.sourceDateRange, { start: null, end: null });
  validateMeta(unknownMeta, [unknown, knownYear]);
});

test('legacy catalogs migrate all former fields intact without inferring any new information', () => {
  const current = paper();
  const legacy = Object.fromEntries(LEGACY_PUBLIC_FIELDS.map((field) => [field, current[field]]));
  const migrated = migrateLegacyCatalog([legacy]);
  assert.deepEqual(migrated, [current]);
  assert.equal(migrated[0].id, legacy.id);
  assert.equal(migrated[0].paperUrl, legacy.arxivUrl);
  assert.equal(migrated[0].publicationYear, null);
  assert.equal(migrated[0].pdfUrl, null);
  assert.equal(migrated[0].bibtex, '');
  assert.equal(Object.keys(legacy).length, 14);
  assert.throws(() => migrateLegacyCatalog([{ ...legacy, notionPageId: PAGE }]), /exactly/);
  assert.deepEqual(migrateLegacyCatalog([current]), [current]);
  const reference = mapNotionPage(referenceFixture());
  const legacyReference = Object.fromEntries(REFERENCE_PUBLIC_FIELDS.map((field) => [field, reference[field]]));
  assert.equal(Object.keys(legacyReference).length, 19);
  assert.deepEqual(migrateLegacyCatalog([legacyReference]), [reference]);
  assert.equal(migrateLegacyCatalog([legacyReference])[0].majorCategory, null);
  assert.deepEqual(migrateLegacyCatalog([legacyReference])[0].subcategories, []);
  assert.throws(() => migrateLegacyCatalog([{ ...legacyReference, classificationRationale: 'private' }]), /exactly/);
});

test('reference validation rejects duplicate normalized URLs, unsafe links and invalid years', () => {
  const first = referenceFixture();
  const same = referenceFixture();
  same.properties['Paper URL'].url += '#different-section';
  assert.throws(() => validatePapers([mapNotionPage(first), mapNotionPage(same)]), /duplicate/);
  const current = mapNotionPage(first);
  assert.throws(() => validatePapers([{ ...current, pdfUrl: 'javascript:alert(1)' }]), /HTTP/);
  assert.throws(() => validatePapers([{ ...current, paperUrl: 'https://user:password@example.org/paper' }]), /credentials/);
  assert.throws(() => paperIdentity('https://example.org/paper\u0000'), /control characters/);
  assert.throws(() => validatePapers([{ ...current, arxivUrl: 'https://arxiv.org/abs/2605.12345' }]), /disagree/);
  assert.throws(() => validatePapers([{ ...current, id: PAGE }]), /disagree/);
  for (const year of [0, 9999, 2022.5, '2022']) assert.throws(() => validatePapers([{ ...current, publicationYear: year }]), /publicationYear/);
  assert.throws(() => validatePapers([{ ...current, doi: 'http://doi.org/10.12345/example' }]), /canonical/);
  assert.throws(() => validatePapers([{ ...current, privateNotes: 'not public' }]), /exactly/);
});

test('rich-text fragments preserve full long author, contribution and abstract text', () => {
  const source = fixture();
  const authors = 'Author Name; '.repeat(900);
  const abstract = 'World models learn actions.\n'.repeat(250);
  const chunks = (value) => Array.from({ length: Math.ceil(value.length / 1900) }, (_, i) => value.slice(i * 1900, (i + 1) * 1900));
  source.properties.Authors = rich(...chunks(authors));
  source.properties['English Abstract'] = rich(...chunks(abstract));
  const actual = mapNotionPage(source);
  assert.equal(actual.authors, authors);
  assert.equal(actual.abstract, abstract);
  validatePapers([actual]);
});

test('code links handle Markdown, rich-text links, punctuation, deduplication and balanced parentheses', () => {
  const links = rich('[Code](https://github.com/example/model).\nhttps://github.com/example/model; https://example.org/release(v1)');
  links.rich_text.push({ plain_text: ' Code', text: { content: ' Code', link: { url: 'https://github.com/example/model' } }, href: 'https://github.com/example/model' });
  assert.deepEqual(propertyUrls(links), ['https://github.com/example/model', 'https://example.org/release(v1)']);
  assert.deepEqual(propertyUrls(rich('https://example.org/a,https://example.org/b')), ['https://example.org/a', 'https://example.org/b']);
  assert.deepEqual(propertyUrls(rich('None')), []);
  assert.throws(() => propertyUrls(rich('javascript:alert(1)')), /no HTTP/);
  assert.throws(() => propertyUrls(rich('https://user:password@example.org/code')), /credentials/);
});

test('mapping retains recorded venue and project fields without inferring missing links', () => {
  const source = fixture();
  source.properties['Web Page'].url = 'https://example.org/project';
  source.properties['论文收录'] = rich('Conference ', '2026');
  source.properties['English Abstract'] = rich('Code is mentioned at https://example.org/unverified.');
  const actual = mapNotionPage(source);
  assert.equal(actual.projectUrl, 'https://example.org/project');
  assert.equal(actual.venue, 'Conference 2026');
  assert.deepEqual(actual.codeUrls, []);
});

test('arXiv PDF and version URLs normalize; unrelated hosts and invalid identifiers fail', () => {
  assert.deepEqual(arxivIdentity('http://export.arxiv.org/pdf/2605.12345v3.pdf'), { id: '2605.12345', arxivUrl: 'https://arxiv.org/abs/2605.12345' });
  assert.equal(arxivIdentity('https://arxiv.org/abs/cs.AI/9901001v1').id, 'cs.AI/9901001');
  assert.throws(() => arxivIdentity('https://arxiv.org.evil.test/abs/2605.12345'), /arxiv.org/);
  assert.throws(() => arxivIdentity('https://arxiv.org/abs/not-a-paper'), /identifier/);
});

test('validation rejects duplicates, impossible dates, unsafe URLs, unknown categories and extra fields', () => {
  assert.throws(() => validatePapers([paper(), paper()]), /duplicate/);
  for (const submittedDate of ['2026-02-30', '2026-13-01', '2026-05-01T00:00:00Z']) assert.throws(() => validatePapers([{ ...paper(), submittedDate }]), /date/);
  assert.throws(() => validatePapers([{ ...paper(), projectUrl: 'javascript:alert(1)' }]), /HTTP/);
  assert.throws(() => validatePapers([{ ...paper(), primaryCategory: 'Unreviewed Category' }]), /category/);
  assert.throws(() => validatePapers([{ ...paper(), secondaryCategories: ['None'] }]), /secondary category/);
  assert.throws(() => validatePapers([{ ...paper(), notionPageId: PAGE }]), /exactly/);
  assert.throws(() => validatePapers([{ ...paper(), authors: '' }]), /authors/);
  assert.equal(CATEGORIES.length, 9);
});

test('empty and large-decrease safeguards require explicit overrides', () => {
  assert.throws(() => guardDecrease(174, 0), /empty/);
  assert.throws(() => guardDecrease(174, 130), /20%/);
  assert.doesNotThrow(() => guardDecrease(174, 150));
  assert.doesNotThrow(() => guardDecrease(174, 130, { allowLargeDecrease: true }));
  assert.doesNotThrow(() => guardDecrease(174, 0, { allowLargeDecrease: true, allowEmpty: true }));
  assert.throws(() => validatePapers([]), /empty/);
});

test('metadata agrees with the complete catalog and excludes private metadata', () => {
  const papers = [paper()];
  const meta = buildMeta(papers, '2026-09-07T08:00:00.000Z');
  assert.deepEqual(meta.sourceDateRange, { start: '2026-05-04', end: '2026-05-04' });
  assert.equal(validateMeta(meta, papers), meta);
  assert.throws(() => validateMeta({ ...meta, paperCount: 10 }, papers), /does not match/);
  assert.throws(() => validateMeta({ ...meta, sourceId: SOURCE }, papers), /exactly/);
});

test('repeated snapshots preserve metadata, while actual paper edits advance the timestamp', () => {
  const initial = [paper()];
  const originalMeta = buildMeta(initial, '2026-09-07T08:00:00.000Z');
  const duplicate = initial.map((entry) => JSON.parse(JSON.stringify(entry)));
  const same = planCatalogUpdate(duplicate, initial, originalMeta, '2026-09-08T08:00:00.000Z');
  assert.equal(same.changed, false);
  assert.equal(same.meta, originalMeta);
  assert.equal(same.meta.updatedAt, '2026-09-07T08:00:00.000Z');
  const changed = planCatalogUpdate([{ ...paper(), abstract: 'Corrected abstract.' }], initial, originalMeta, '2026-09-08T08:00:00.000Z');
  assert.equal(changed.changed, true);
  assert.equal(changed.meta.updatedAt, '2026-09-08T08:00:00.000Z');
  assert.equal(changed.meta.paperCount, originalMeta.paperCount);
});

test('unchanged papers still repair missing or invalid public metadata', () => {
  const papers = [paper()];
  for (const oldMeta of [undefined, { ...buildMeta(papers), paperCount: 99 }]) {
    const plan = planCatalogUpdate(papers, papers, oldMeta, '2026-09-08T08:00:00.000Z');
    assert.equal(plan.changed, true);
    assert.equal(plan.meta.updatedAt, '2026-09-08T08:00:00.000Z');
    validateMeta(plan.meta, papers);
  }
});

test('local discoveries survive a merge while complete Notion records win ID collisions', () => {
  const notion = [{ ...paper(), title: 'Current editor title', majorCategory: 'VLA' }];
  const localOnly = mapNotionPage(referenceFixture());
  const local = [{ ...paper(), title: 'Earlier discovery title', majorCategory: 'WAM', subcategories: ['Earlier classification'] }, localOnly];
  const before = JSON.stringify({ notion, local });
  const merged = mergeCatalogPapers(notion, local);
  assert.equal(merged.source, 'Notion + arXiv discovery');
  assert.equal(merged.papers.length, 2);
  assert.deepEqual(merged.papers.find(p => p.id === notion[0].id), notion[0]);
  assert.deepEqual(merged.papers.find(p => p.id === localOnly.id), localOnly);
  assert.equal(JSON.stringify({ notion, local }), before);
  assert.deepEqual(mergeCatalogPapers(notion), { papers: notion, source: 'Notion' });
  assert.deepEqual(mergeCatalogPapers(notion, [local[0]]), { papers: notion, source: 'Notion' });
  assert.throws(() => mergeCatalogPapers(notion, [localOnly, localOnly]), /duplicate/);
  assert.throws(() => mergeCatalogPapers([notion[0], notion[0]], local), /duplicate/);
  assert.throws(() => mergeCatalogPapers(notion, [{ ...local[0], privateNotes: 'must not be ignored on collision' }]), /exactly/);
});

test('mixed metadata retains its four-field schema and source-only changes update its timestamp', () => {
  const papers = [paper()];
  const original = buildMeta(papers, '2026-09-07T08:00:00.000Z');
  const changed = planCatalogUpdate(papers, papers, original, '2026-09-08T08:00:00.000Z', 'Notion + arXiv discovery');
  assert.equal(changed.changed, true);
  assert.equal(changed.meta.source, 'Notion + arXiv discovery');
  assert.equal(changed.meta.updatedAt, '2026-09-08T08:00:00.000Z');
  assert.deepEqual(Object.keys(changed.meta), Object.keys(original));
  validateMeta(changed.meta, papers);
  const repeated = planCatalogUpdate(papers, papers, changed.meta, '2026-09-09T08:00:00.000Z', changed.meta.source);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.meta, changed.meta);
  assert.equal(planCatalogUpdate(papers, papers, changed.meta, '2026-09-10T08:00:00.000Z').meta.source, 'Notion');
  assert.throws(() => buildMeta(papers, original.updatedAt, 'unverified'), /source/);
  assert.throws(() => validateMeta({ ...original, source: 'unverified' }, papers), /source/);
  assert.throws(() => validateMeta({ ...changed.meta, scope: 'extra' }, papers), /exactly/);
  assert.throws(() => validateMeta({ ...changed.meta, paperCount: 99 }, papers), /does not match/);
  assert.throws(() => planCatalogUpdate(papers, papers, original, original.updatedAt, 'unverified'), /source/);
});

test('offline sync preserves overlay bytes, editor precedence and idempotence until Notion adopts local IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-overlay-sync-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const papersPath = join(repository, 'data/papers.json');
    const metaPath = join(repository, 'data/meta.json');
    const localPath = join(repository, 'data/local-papers.json');
    const inputPath = join(dir, 'input.json');
    const local = [{ ...paper(), title: 'Stale title', majorCategory: 'WAM' }, mapNotionPage(referenceFixture())];
    const localBytes = `${JSON.stringify(local, null, 2)}\n`;
    await writeFile(localPath, localBytes);
    await writeFile(papersPath, JSON.stringify([paper()]));
    await writeFile(metaPath, JSON.stringify(buildMeta([paper()], '2026-09-07T08:00:00.000Z')));
    const notion = fixture();
    notion.properties['大类'] = select('VLA');
    const snapshot = { results: [notion], fetchedAt: '2026-09-08T08:00:00.000Z', has_more: false };
    await writeFile(inputPath, JSON.stringify(snapshot));
    const args = [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath];
    const sync = () => execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    assert.match(sync(), /Updated data/);
    const merged = JSON.parse(await readFile(papersPath, 'utf8'));
    assert.deepEqual(merged.find(p => p.id === paper().id), mapNotionPage(notion));
    assert.deepEqual(merged.find(p => p.id === local[1].id), local[1]);
    assert.equal(JSON.parse(await readFile(metaPath, 'utf8')).source, 'Notion + arXiv discovery');
    const stable = [await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')];
    assert.match(sync(), /No catalog changes/);
    assert.deepEqual([await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')], stable);
    assert.equal(await readFile(localPath, 'utf8'), localBytes);
    await rm(localPath);
    assert.throws(sync, /Missing data\/local-papers\.json/);
    assert.deepEqual([await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')], stable);
    await writeFile(localPath, JSON.stringify([local[1], local[1]]));
    assert.throws(sync, /duplicate/);
    assert.deepEqual([await readFile(papersPath, 'utf8'), await readFile(metaPath, 'utf8')], stable);
    await writeFile(localPath, localBytes);
    snapshot.results.push(referenceFixture());
    snapshot.fetchedAt = '2026-09-09T08:00:00.000Z';
    await writeFile(inputPath, JSON.stringify(snapshot));
    assert.match(sync(), /Updated data/);
    assert.deepEqual(JSON.parse(await readFile(papersPath, 'utf8')), merged);
    assert.equal(JSON.parse(await readFile(metaPath, 'utf8')).source, 'Notion');
    assert.equal(await readFile(localPath, 'utf8'), localBytes);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('local overlay cannot mask an empty or substantially truncated Notion export', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-overlay-guard-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const notion = Array.from({ length: 10 }, (_, i) => {
      const item = fixture(); item.properties['Paper URL'].url = `https://arxiv.org/abs/2605.${String(10000 + i)}`; return item;
    });
    const local = Array.from({ length: 10 }, (_, i) => {
      const item = fixture(); item.properties['Paper URL'].url = `https://arxiv.org/abs/2606.${String(10000 + i)}`; return mapNotionPage(item);
    });
    const merged = mergeCatalogPapers(notion.map(mapNotionPage), local);
    const papersPath = join(repository, 'data/papers.json');
    const metaPath = join(repository, 'data/meta.json');
    const inputPath = join(dir, 'input.json');
    const original = JSON.stringify(merged.papers);
    const originalMeta = JSON.stringify(buildMeta(merged.papers, '2026-09-07T08:00:00.000Z', merged.source));
    await writeFile(papersPath, original);
    await writeFile(metaPath, originalMeta);
    await writeFile(join(repository, 'data/local-papers.json'), JSON.stringify(local));
    const sync = () => execFileSync(process.execPath, [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    for (const [results, message] of [[[], /empty/], [notion.slice(0, 7), /decrease from 10 to 7/]]) {
      await writeFile(inputPath, JSON.stringify({ results, fetchedAt: '2026-09-08T08:00:00.000Z', has_more: false }));
      assert.throws(sync, message);
      assert.equal(await readFile(papersPath, 'utf8'), original);
      assert.equal(await readFile(metaPath, 'utf8'), originalMeta);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('raw snapshot guard rejects in-repo ..audit directories and symlinks into the repo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-snapshot-test-'));
  try {
    const repository = join(dir, 'repo');
    await mkdir(join(repository, '..audit'), { recursive: true });
    await symlink(join(repository, '..audit'), join(dir, 'linked-audit'));
    await assert.rejects(privateSnapshotPath(join(repository, 'snapshot.json'), repository), /outside/);
    await assert.rejects(privateSnapshotPath(join(repository, '..audit/snapshot.json'), repository), /outside/);
    await assert.rejects(privateSnapshotPath(join(dir, 'linked-audit/snapshot.json'), repository), /outside/);
    assert.match(await privateSnapshotPath(join(dir, 'snapshot.json'), repository), /snapshot\.json$/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('sync keeps catalog files stable while refreshing a private snapshot, then writes real content changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-sync-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const papersPath = join(repository, 'data/papers.json');
    const metaPath = join(repository, 'data/meta.json');
    const inputPath = join(dir, 'input.json');
    const snapshotPath = join(dir, 'private-snapshot.json');
    const originalPapers = `${JSON.stringify([paper()], null, 2)}\n`;
    const originalMeta = `${JSON.stringify(buildMeta([paper()], '2026-09-07T08:00:00.000Z'), null, 2)}\n`;
    await writeFile(papersPath, originalPapers);
    await writeFile(metaPath, originalMeta);
    const snapshot = { results: [fixture()], fetchedAt: '2026-09-08T08:00:00.000Z', has_more: false };
    await writeFile(inputPath, JSON.stringify(snapshot));
    const args = [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath, '--snapshot', snapshotPath];
    const output = execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.match(output, /No catalog changes/);
    assert.equal(await readFile(papersPath, 'utf8'), originalPapers);
    assert.equal(await readFile(metaPath, 'utf8'), originalMeta);
    assert.equal(JSON.parse(await readFile(snapshotPath, 'utf8')).fetchedAt, snapshot.fetchedAt);
    snapshot.results[0].properties['English Abstract'] = rich('A corrected abstract.');
    snapshot.fetchedAt = '2026-09-09T08:00:00.000Z';
    await writeFile(inputPath, JSON.stringify(snapshot));
    assert.match(execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 }), /Updated data/);
    assert.equal(JSON.parse(await readFile(papersPath, 'utf8'))[0].abstract, 'A corrected abstract.');
    assert.equal(JSON.parse(await readFile(metaPath, 'utf8')).updatedAt, snapshot.fetchedAt);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const legacyFields of [LEGACY_PUBLIC_FIELDS, REFERENCE_PUBLIC_FIELDS]) test(`sync upgrades an unchanged ${legacyFields.length}-field catalog once, then retains no-change behavior`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-migration-test-'));
  try {
    const repository = join(dir, 'repo');
    await copyImportRuntime(repository);
    await mkdir(join(repository, 'data'));
    const legacy = Object.fromEntries(legacyFields.map((field) => [field, paper()[field]]));
    const papersPath = join(repository, 'data/papers.json');
    const metaPath = join(repository, 'data/meta.json');
    const inputPath = join(dir, 'input.json');
    const originalMeta = buildMeta([paper()], '2026-09-07T08:00:00.000Z');
    await writeFile(papersPath, JSON.stringify([legacy]));
    await writeFile(metaPath, JSON.stringify(originalMeta));
    await writeFile(inputPath, JSON.stringify({ results: [fixture()], fetchedAt: '2026-09-08T08:00:00.000Z', has_more: false }));
    const args = [join(repository, 'scripts/sync-notion.mjs'), '--input', inputPath];
    const first = execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.match(first, /Legacy catalog/);
    assert.match(first, /Updated data/);
    assert.deepEqual(JSON.parse(await readFile(papersPath, 'utf8')), [paper()]);
    assert.deepEqual(JSON.parse(await readFile(metaPath, 'utf8')), originalMeta);
    assert.match(execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 }), /No catalog changes/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('pagination gathers all pages using each server cursor', async () => {
  const cursors = [];
  const results = await paginate(async (cursor) => {
    cursors.push(cursor);
    return cursor ? { results: [3], has_more: false, next_cursor: null } : { results: [1, 2], has_more: true, next_cursor: 'next' };
  });
  assert.deepEqual(results, [1, 2, 3]);
  assert.deepEqual(cursors, [undefined, 'next']);
});

test('pagination rejects repeated or missing cursors and incomplete API results', async () => {
  await assert.rejects(paginate(async () => ({ results: [], has_more: true, next_cursor: 'same' })), /did not advance/);
  await assert.rejects(paginate(async () => ({ results: [], has_more: true, next_cursor: null })), /did not advance/);
  await assert.rejects(paginate(async () => ({ results: [], has_more: false, request_status: { type: 'incomplete' } })), /incomplete/);
});

test('full property pagination reconstructs truncated long text before mapping', async () => {
  const source = fixture();
  source.properties.Authors = { ...rich('truncated'), id: 'a%3Ab', has_more: true };
  const paths = [];
  const results = await queryAllPages(async (path, body) => {
    paths.push(path);
    if (body) return { results: [source], has_more: false };
    if (path.includes('start_cursor=')) return { results: [{ rich_text: text('Second Author') }], has_more: false };
    return { results: [{ rich_text: text('First Author; ') }], has_more: true, next_cursor: 'property-next' };
  }, SOURCE);
  assert.equal(mapNotionPage(results[0]).authors, 'First Author; Second Author');
  assert.match(paths[1], /properties\/a%3Ab\?page_size=100/);
  assert.match(paths[2], /start_cursor=property-next/);
});

test('transient retries honor Retry-After and permanent errors stop immediately', async () => {
  let attempts = 0;
  const delays = [];
  const result = await withRetry(async () => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error('rate limit'), { status: 429, retryAfterMs: 1200 });
    return 'done';
  }, { wait: async (ms) => delays.push(ms) });
  assert.equal(result, 'done');
  assert.deepEqual(delays, [1200, 1200]);
  let permanentAttempts = 0;
  await assert.rejects(withRetry(async () => { permanentAttempts++; throw Object.assign(new Error('unauthorized'), { status: 401 }); }, { wait: async () => {} }), /unauthorized/);
  assert.equal(permanentAttempts, 1);
});

test('token reader only accepts read operations and retries a rate-limited query', async () => {
  const calls = [];
  const waits = [];
  const reader = createNotionReader({ token: 'test-only', wait: async (ms) => waits.push(ms), fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response('', { status: 429, headers: { 'Retry-After': '2' } });
    return Response.json({ results: [], has_more: false });
  } });
  await reader(`v1/data_sources/${SOURCE}/query`, { page_size: 100 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(waits, [2000]);
  await assert.rejects(reader('v1/pages', { properties: {} }), /read-only/);
});

test('CLI transport closes stdin, so a JSON body supplied with -d cannot hang', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-cli-test-'));
  const oldPath = process.env.PATH;
  try {
    await writeFile(join(dir, 'ntn'), '#!/usr/bin/env node\nsetTimeout(() => process.exit(7), 1500).unref();\nprocess.stdin.resume();\nprocess.stdin.on("end", () => { process.stdout.write(JSON.stringify({ results: [], has_more: false })); });\n', { mode: 0o755 });
    process.env.PATH = `${dir}:${oldPath}`;
    const reader = createNotionReader({ cli: true });
    assert.deepEqual(await reader(`v1/data_sources/${SOURCE}/query`, { page_size: 100 }), { results: [], has_more: false });
  } finally { process.env.PATH = oldPath; await rm(dir, { recursive: true, force: true }); }
});

test('atomic writer creates complete JSON files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wam-data-test-'));
  try {
    await atomicWriteFiles([[join(dir, 'papers.json'), JSON.stringify([paper()])], [join(dir, 'meta.json'), JSON.stringify(buildMeta([paper()]))]]);
    assert.equal(JSON.parse(await readFile(join(dir, 'papers.json'), 'utf8'))[0].id, paper().id);
    assert.equal(JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')).paperCount, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
