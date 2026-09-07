import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { validateIllustratedReport, validateIllustratedMetadata, validateIllustratedCollection } from '../scripts/lib/illustrated-reports.mjs';
const base = JSON.parse(await readFile(new URL('../data/reports/2608.08839.json', import.meta.url), 'utf8'));
const original = JSON.parse(await readFile(new URL('../data/illustrated-reports/2608.08839.json', import.meta.url), 'utf8'));
const mutate = fn => { const clone = structuredClone(original); fn(clone); return clone; };
test('accepts an illustrated edition tied to a verified paper', () => assert.equal(validateIllustratedReport(original, base), original));
test('rejects a figure attributed to a different PDF', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals[0].sourceSha256 = '0'.repeat(64)), base), /fingerprint/));
test('rejects page links that do not match the crop location', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals[0].sourceUrl += '2'), base), /source URL/));
test('rejects traversal outside published figure assets', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals[0].asset = '../reading_work/source.pdf'), base), /private source paths|unsafe asset/));
test('rejects impossible crop bounds', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals[0].crop = [.8, .1, .2, .7]), base), /crop/));
test('requires an actual quantitative table', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals.forEach(v => v.kind = 'figure')), base), /quantitative table/));
test('requires every visual to have been inspected', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visualAudit.inspectedPages = []), base), /visual audit/));
test('requires traceable scientific explanations', () => assert.throws(() => validateIllustratedReport(mutate(r => r.visuals[0].evidenceIds = ['invented']), base), /evidence/));
test('featured results must resolve to an existing reported task', () => {
  const valid = mutate(r => r.featuredResultTask = base.results[0].task);
  assert.equal(validateIllustratedReport(valid, base), valid);
  assert.throws(() => validateIllustratedReport(mutate(r => r.featuredResultTask = 'Invented result'), base), /featuredResultTask/);
});

const limitedEdition = () => mutate(r => {
  r.visuals = [r.visuals[0]];
  r.visualLimitations = { kind: 'analysis', text: 'This fixture models a source that supplies a conceptual diagram but no quantitative table or ablation.', evidenceIds: [base.evidence[0].id] };
});
test('a source-grounded limitation permits fewer visuals without inventing experiments', () => {
  const edition = limitedEdition();
  assert.equal(validateIllustratedReport(edition, base), edition);
  delete edition.visualLimitations;
  assert.throws(() => validateIllustratedReport(edition, base), /four to six/);
});
test('visual exceptions require a substantive explanation and valid source evidence', () => {
  for (const change of [r => r.visualLimitations.text = ' ', r => r.visualLimitations.kind = 'open-question', r => r.visualLimitations.evidenceIds = [], r => r.visualLimitations.evidenceIds = ['invented']]) {
    const edition = limitedEdition(); change(edition);
    assert.throws(() => validateIllustratedReport(edition, base), /visualLimitations|visual limitations/);
  }
});
test('visual exceptions cannot admit empty editions, abstracts or non-PDF crops', () => {
  const empty = limitedEdition(); empty.visuals = [];
  assert.throws(() => validateIllustratedReport(empty, base), /at least one/);
  const abstract = structuredClone(base); abstract.coverage.scope = 'abstract-only';
  assert.throws(() => validateIllustratedReport(limitedEdition(), abstract), /abstract-only/);
  const textSource = structuredClone(base); textSource.sources[0].kind = 'text';
  assert.throws(() => validateIllustratedReport(limitedEdition(), textSource), /PDF page/);
});
test('a visual limitation does not waive the six-image maximum', () => {
  const edition = limitedEdition(); edition.visuals = Array(7).fill(edition.visuals[0]);
  assert.throws(() => validateIllustratedReport(edition, base), /four to six/);
});
test('title metadata must match the primary source and identify its inspected location', () => {
  const metadata = { authors: 'Fixture author', sourceSha256: base.sources[0].sha256, page: 1 };
  assert.equal(validateIllustratedMetadata(metadata, base), metadata);
  const located = { authors: metadata.authors, sourceSha256: metadata.sourceSha256, location: 'Official resource title and author credits' };
  assert.equal(validateIllustratedMetadata(located, base), located);
  assert.throws(() => validateIllustratedMetadata({ ...metadata, sourceSha256: '0'.repeat(64) }, base), /primary source/);
  assert.throws(() => validateIllustratedMetadata({ ...metadata, authors: '' }, base), /metadata/);
  assert.throws(() => validateIllustratedMetadata({ ...metadata, page: undefined }, base), /location/);
  assert.throws(() => validateIllustratedMetadata({ ...metadata, page: 0 }, base), /page/);
});

async function collectionFixture(t, { count = 11, state = 'approved' } = {}) {
  const repository = await mkdtemp(join(tmpdir(), 'wam-illustrated-test-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  const put = async (path, data) => { await mkdir(dirname(join(repository, path)), { recursive: true }); await writeFile(join(repository, path), JSON.stringify(data)); };
  const reports = [], metadata = {};
  const pilot = { state, approvedAt: '2026-09-07T20:11:41Z', reason: 'Explicit fixture approval.', paperIds: Array.from({ length: 10 }, (_, i) => `fixture-${i}`) };
  await put('data/report-pilot.json', pilot);
  for (let i = 0; i < count; i++) {
    const id = `fixture-${i}`, report = structuredClone(base), edition = structuredClone(original);
    report.paperId = edition.paperId = id;
    reports.push(report);
    metadata[id] = { authors: 'Fixture author', sourceSha256: report.sources[0].sha256, page: 1 };
    for (const visual of edition.visuals) {
      visual.asset = `report-assets/${id}/${visual.id}.png`;
      await mkdir(dirname(join(repository, 'public', visual.asset)), { recursive: true });
      // The validator checks PNG signatures and dimensions; the fixture supplies only that header.
      const header = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(header);
      header.writeUInt32BE(visual.width, 16); header.writeUInt32BE(visual.height, 20);
      await writeFile(join(repository, 'public', visual.asset), header);
    }
    await put(`data/illustrated-reports/${id}.json`, edition);
  }
  await put('data/illustrated-report-metadata.json', metadata);
  return { repository, reports, metadata, pilot, put };
}
test('an approved collection accepts additional verified editions beyond the retained pilot', async t => {
  const f = await collectionFixture(t);
  assert.equal((await validateIllustratedCollection(f.repository, f.reports)).length, 11);
});
test('an awaiting-review collection accepts the ten pilots but rejects an eleventh edition', async t => {
  const f = await collectionFixture(t, { state: 'awaiting-user-review' });
  await assert.rejects(validateIllustratedCollection(f.repository, f.reports), /before user approval/);
  await unlink(join(f.repository, 'data/illustrated-reports/fixture-10.json'));
  assert.equal((await validateIllustratedCollection(f.repository, f.reports)).length, 10);
});
test('approval does not permit dropping an original pilot', async t => {
  const f = await collectionFixture(t);
  await unlink(join(f.repository, 'data/illustrated-reports/fixture-0.json'));
  await assert.rejects(validateIllustratedCollection(f.repository, f.reports), /all ten pilot/);
});
test('every added edition requires verified title metadata and a matching base report', async t => {
  const f = await collectionFixture(t);
  delete f.metadata['fixture-10']; await f.put('data/illustrated-report-metadata.json', f.metadata);
  await assert.rejects(validateIllustratedCollection(f.repository, f.reports), /verified title-block metadata/);
  await assert.rejects(validateIllustratedCollection(f.repository, f.reports.slice(0, 10)), /mismatched paper identity/);
});
test('new editions retain actual asset dimension validation', async t => {
  const f = await collectionFixture(t);
  const path = join(f.repository, 'public/report-assets/fixture-10', `${original.visuals[0].id}.png`);
  const image = await readFile(path); image.writeUInt32BE(1, 16); await writeFile(path, image);
  await assert.rejects(validateIllustratedCollection(f.repository, f.reports), /PNG dimensions/);
});
