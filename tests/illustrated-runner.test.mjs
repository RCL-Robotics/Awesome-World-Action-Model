import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, writeFile, rm, symlink, link, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { classificationSnapshot, readJSON, writeJSON } from '../scripts/lib/reports.mjs';
import { DEFAULT_PYTHON, exists, fileHash, inspectedImagePaths, publishBundle, publishedReceipt, safeFile, sha, snapshotSource, validateBundle, validateVisualReview, verifyCompletion, verifySource } from '../scripts/lib/illustrated-runner.mjs';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const template = await readJSON(join(repository, 'data/reports/2608.08839.json'));
const editionTemplate = await readJSON(join(repository, 'data/illustrated-reports/2608.08839.json'));
const catalogPaper = (await readJSON(join(repository, 'data/papers.json'))).find(paper => paper.id === template.paperId);
const date = '2026-09-08T00:00:00.000Z';
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'wam-illustrated-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function fixture(t, pdf = false) {
  const root = await temporary(t), attempt = join(root, 'attempt'), output = join(root, 'repository');
  await mkdir(output); await mkdir(join(root, 'sources'));
  const text = 'Page 1\nFixture title and author. Source section for test evidence.\n'.repeat(350);
  const sourcePath = join(root, 'sources', pdf ? 'original.pdf' : 'original.txt'), textPath = join(root, 'sources/text.txt');
  await writeFile(textPath, text);
  if (pdf) await execute(DEFAULT_PYTHON, ['-c', 'from reportlab.pdfgen.canvas import Canvas; import sys; c=Canvas(sys.argv[1],pagesize=(400,400)); c.drawString(50,350,"Original test diagram"); c.rect(40,100,300,180); c.line(40,100,340,280); c.save()', sourcePath]);
  else await writeFile(sourcePath, text);
  const manifest = { paperId: 'fixture', titleMatch: true, accessStatus: 'partial-text', kind: pdf ? 'pdf' : 'text', sourcePath, textPath, sha256: await fileHash(sourcePath), textSha256: sha(Buffer.from(text)), observedTitle: 'Fixture title', canonicalUrl: 'https://example.org/fixture', wordCount: text.split(/\s+/).length, accessedAt: date, scope: 'selected-sections', omissions: ['Only the supplied fixture section is available.'] };
  const config = await snapshotSource({ attempt, manifest, repository });
  const paper = { ...catalogPaper, id: 'fixture', title: manifest.observedTitle };
  const context = { paper, manifest, config, classification: classificationSnapshot(paper, date), generatedAt: date, repository, paperIds: new Set(['fixture']) };
  const report = structuredClone(template);
  report.paperId = paper.id; report.generatedAt = date; report.reportStatus = 'partial-text-reviewed'; report.relatedPaperIds = [];
  report.sources = [{ id: 'primary', url: manifest.canonicalUrl, title: manifest.observedTitle, kind: manifest.kind, sha256: manifest.sha256, wordCount: manifest.wordCount, accessedAt: date }];
  report.coverage = { ...report.coverage, scope: 'selected-sections', omissions: manifest.omissions, figuresReviewed: [], tablesReviewed: [] };
  report.taxonomy.recordedClassification = context.classification;
  const metadata = { title: manifest.observedTitle, authors: 'Fixture Author', sourceSha256: manifest.sha256, ...(pdf ? { page: 1 } : { location: 'Fixture title and author heading' }) };
  const receipt = { schemaVersion: 1, paperId: paper.id, outcome: pdf ? 'illustrated' : 'illustration-unavailable', reason: pdf ? '' : 'The supplied verified source contains text without a usable PDF.', evidenceIds: [report.evidence[0].id], baseReportPath: 'report.json', editionPath: pdf ? 'edition.json' : null, metadataPath: 'metadata.json' };
  await writeJSON(join(attempt, 'report.json'), report); await writeJSON(join(attempt, 'metadata.json'), metadata); await writeJSON(join(attempt, 'receipt.json'), receipt);
  for (let chunk = 1; chunk <= config.chunks.length; chunk++) await execute(DEFAULT_PYTHON, [join(attempt, 'source-tool.py'), '--root', attempt, 'read', String(chunk)]);
  await writeFile(join(attempt, 'events.jsonl'), '');
  if (pdf) {
    const tool = (...args) => execute(DEFAULT_PYTHON, [join(attempt, 'source-tool.py'), '--root', attempt, ...args]);
    await tool('render', '1');
    const crop = JSON.parse((await tool('crop', '1', 'architecture', '.08', '.1', '.9', '.8')).stdout);
    const edition = structuredClone(editionTemplate);
    edition.paperId = paper.id;
    edition.visuals = [{ ...edition.visuals[0], id: crop.id, page: 1, crop: crop.crop, asset: 'report-assets/fixture/architecture.png', width: crop.width, height: crop.height, sourceSha256: manifest.sha256, sourceUrl: `${manifest.canonicalUrl}#page=1` }];
    edition.visualLimitations = { kind: 'source', text: 'The supplied fixture has one conceptual diagram and no experimental tables or ablation.', evidenceIds: [report.evidence[0].id] };
    edition.visualAudit.inspectedPages = [1];
    await writeJSON(join(attempt, 'edition.json'), edition);
    await writeFile(join(attempt, 'events.jsonl'), ['renders/page-1-200.png', 'assets/architecture.png'].map(path => JSON.stringify({ type: 'item.completed', item: { type: 'image_view', path, status: 'completed' } })).join('\n'));
  }
  return { root, attempt, output, context, report, manifest, receipt, reviewImages: async () => true };
}

test('limited non-PDF sources remain honest text reports and resume without empty editions', async t => {
  const f = await fixture(t);
  await verifySource(f.manifest, f.root);
  const bundle = await validateBundle(f);
  assert.equal(bundle.edition, null);
  const published = await publishBundle(f.output, f.attempt, bundle);
  const status = { ...published, state: 'illustration-unavailable', sourceSha256: f.manifest.sha256, textSha256: f.manifest.textSha256 };
  assert.equal(await verifyCompletion(f.output, status, f.manifest), true);
  assert.equal(await exists(join(f.output, 'data/illustrated-reports/fixture.json')), false);
  await writeFile(join(f.output, 'data/reports/fixture.json'), '{}');
  await assert.rejects(verifyCompletion(f.output, status, f.manifest), /artifact changed/);
});
test('acquisition omissions are retained alongside the reader scope disclosures', async t => {
  const f = await fixture(t);
  const readerOmission = 'The reader did not inspect any separate supplemental release.';
  f.report.coverage.omissions = [readerOmission];
  await writeJSON(join(f.attempt, 'report.json'), f.report);
  const draft = await readFile(join(f.attempt, 'report.json'), 'utf8');
  const bundle = await validateBundle(f);
  assert.deepEqual(new Set(bundle.report.coverage.omissions), new Set([...f.manifest.omissions, readerOmission]));
  assert.equal(await readFile(join(f.attempt, 'report.json'), 'utf8'), draft);
  await publishBundle(f.output, f.attempt, bundle);
  assert.deepEqual((await readJSON(join(f.output, 'data/reports/fixture.json'))).coverage.omissions, bundle.report.coverage.omissions);

  f.report.coverage.omissions = [...f.manifest.omissions, readerOmission];
  await writeJSON(join(f.attempt, 'report.json'), f.report);
  const repeated = await validateBundle(f);
  assert.equal(repeated.report.coverage.omissions.length, 2);
});
test('a faithful original PDF crop validates and interrupted publication is recoverable', async t => {
  const f = await fixture(t, true), bundle = await validateBundle(f);
  const published = await publishBundle(f.output, f.attempt, bundle);
  const recovered = await publishedReceipt(f.output, bundle);
  assert.deepEqual(new Set(recovered.files.map(f => `${f.path}:${f.sha256}`)), new Set(published.files.map(f => `${f.path}:${f.sha256}`)));
  await assert.rejects(publishBundle(f.output, f.attempt, bundle), /overwrite an existing/);
});
test('raw fingerprints, complete reading and private output boundaries are mandatory', async t => {
  const f = await fixture(t);
  await writeFile(join(f.attempt, 'source-audit.jsonl'), '');
  await assert.rejects(validateBundle(f), /chunk 1 was not read/);
  await writeFile(f.manifest.sourcePath, 'changed');
  await assert.rejects(verifySource(f.manifest, f.root), /hash mismatch/);
  const outside = join(f.root, 'outside.json'); await writeFile(outside, '{}');
  await assert.rejects(safeFile(f.attempt, '../outside.json'), /Unsafe/);
  await symlink(outside, join(f.attempt, 'linked.json'));
  await assert.rejects(safeFile(f.attempt, 'linked.json'), /Symlink/);
  await link(outside, join(f.attempt, 'hardlinked.json'));
  await assert.rejects(safeFile(f.attempt, 'hardlinked.json'), /hard links/);
});
test('bad receipts or unsupported provenance cannot change an existing base report', async t => {
  const f = await fixture(t);
  await mkdir(join(f.output, 'data/reports'), { recursive: true });
  await writeFile(join(f.output, 'data/reports/fixture.json'), 'original');
  f.receipt.baseReportPath = '../other.json';
  await writeJSON(join(f.attempt, 'receipt.json'), f.receipt);
  await assert.rejects(validateBundle(f), /receipt/);
  assert.equal(await readFile(join(f.output, 'data/reports/fixture.json'), 'utf8'), 'original');
});
test('started, failed and unclaimed image views cannot attest inspection', async t => {
  assert.deepEqual([...inspectedImagePaths([
    { type: 'item.started', item: { type: 'image_view', path: 'unseen.png' } },
    { type: 'item.completed', item: { type: 'image_view', status: 'failed', path: 'failed.png' } },
    { type: 'item.completed', item: { type: 'image_view', status: 'completed', path: 'seen.png' } }
  ])], ['seen.png']);
  const f = await fixture(t, true);
  const edition = await readJSON(join(f.attempt, 'edition.json')); edition.visualAudit.inspectedPages.push(2);
  await writeJSON(join(f.attempt, 'edition.json'), edition);
  await assert.rejects(validateBundle(f), /declared inspected page/);
});
test('missing native image events require independently delivered and approved images', async t => {
  const f = await fixture(t, true);
  await writeFile(join(f.attempt, 'events.jsonl'), '');
  await assert.rejects(validateBundle({ ...f, reviewImages: undefined }), /independent attached-image review/);
  // Forged native records in the writer's directory cannot bypass the reviewer.
  await writeFile(join(f.attempt, 'events.jsonl'), ['renders/page-1-200.png', 'assets/architecture.png'].map(path => JSON.stringify({ type: 'item.completed', item: { type: 'image_view', path, status: 'completed' } })).join('\n'));
  await assert.rejects(validateBundle({ ...f, reviewImages: undefined }), /independent attached-image review/);
  let reviewed = 0;
  const bundle = await validateBundle({ ...f, reviewImages: async packet => {
    assert.equal(packet.images.length, 2);
    for (const image of packet.images) {
      assert.ok(!image.path.startsWith(`${f.attempt}/`));
      assert.equal(await fileHash(image.path), image.sha256);
    }
    const review = { schemaVersion: 1, paperId: f.context.paper.id, sourceSha256: f.manifest.sha256, approved: true, identityMatches: true, identityNotes: 'Fixture title page matches.', images: packet.images.map(image => ({ imageId: image.imageId, sha256: image.sha256, legible: true, matchesDescription: true, claimsSupported: true, observedDetail: 'The original diagram contains a rectangle and diagonal line.' })) };
    const expected = { paperId: f.context.paper.id, sourceSha256: f.manifest.sha256, images: packet.images };
    assert.equal(validateVisualReview(review, expected), true);
    for (const change of [r => r.approved = false, r => r.images.pop(), r => r.images[0].sha256 = '0'.repeat(64), r => r.identityMatches = false]) {
      const bad = structuredClone(review); change(bad); assert.throws(() => validateVisualReview(bad, expected), /reviewer rejected/);
    }
    for (const kind of ['source-page', 'crop']) {
      const index = packet.images.findIndex(image => image.kind === kind);
      assert.notEqual(index, -1, `The review must contain a ${kind}.`);
      for (const field of ['legible', 'matchesDescription', 'claimsSupported']) {
        const bad = structuredClone(review); bad.images[index][field] = false;
        assert.throws(() => validateVisualReview(bad, expected), /reviewer rejected/, `${kind} ${field}=false must never be waived.`);
      }
    }
    reviewed++; return true;
  } });
  assert.equal(reviewed, 1); assert.equal(bundle.edition.visuals.length, 1);
  await assert.rejects(validateBundle({ ...f, reviewImages: async () => false }), /did not approve/);
});

async function runnerFixture(t, ids = ['fixture-a', 'fixture-b', 'fixture-c']) {
  const root = await temporary(t), repo = join(root, 'repo'), work = join(root, 'work'), control = join(root, 'control');
  await mkdir(repo); await mkdir(control);
  for (const name of ['scripts/lib', 'scripts/reading/run-illustrated.mjs', 'scripts/reading/illustrated-source.py', 'src/lib/classification-snapshot.mjs', 'src/lib/taxonomy.mjs', 'schemas', 'skills/wam-paper-reader']) {
    await mkdir(dirname(join(repo, name)), { recursive: true }); await cp(join(repository, name), join(repo, name), { recursive: true });
  }
  const put = async (name, value) => writeJSON(join(repo, name), value);
  await put('data/papers.json', ids.map(id => ({ ...catalogPaper, id })));
  await put('data/meta.json', { updatedAt: date });
  await put('data/report-pilot.json', { state: 'approved', approvedAt: date, paperIds: Array.from({ length: 10 }, (_, n) => `pilot-${n}`) });
  await put('data/illustrated-report-metadata.json', {});
  for (const id of ids) {
    const directory = join(work, 'sources', id); await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'source.txt'), 'Fixture text source.\n');
    const path = join(directory, 'source.txt'), hash = await fileHash(path);
    await writeJSON(join(directory, 'manifest.json'), { paperId: id, titleMatch: true, accessStatus: 'partial-text', kind: 'text', sourcePath: path, textPath: path, sha256: hash, textSha256: hash, observedTitle: 'Fixture title', canonicalUrl: `https://example.org/${id}`, wordCount: 3, accessedAt: date, scope: 'selected-sections', omissions: ['Only a fixture section is supplied.'] });
  }
  await writeJSON(join(control, 'template.json'), template);
  const fake = join(root, 'fake-codex.mjs');
  await writeFile(fake, `#!${process.execPath}
import fs from 'node:fs/promises';
import path from 'node:path';
const d = process.env.ILLUSTRATED_CONTROL;
let prompt = ''; for await (const chunk of process.stdin) prompt += chunk;
let review; try { review = JSON.parse(await fs.readFile('review-context.json', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (review) {
  let calls = 0; try { calls = Number(await fs.readFile(path.join(d, review.paperId + '.review-calls'), 'utf8')); } catch {}
  calls++;
  await fs.writeFile(path.join(d, review.paperId + '.review-calls'), String(calls));
  await fs.writeFile(path.join(d, review.paperId + '.review-prompt-' + calls), prompt);
  await fs.writeFile(path.join(d, review.paperId + '.review-args-' + calls), JSON.stringify(process.argv));
  await fs.writeFile('receipt.json', JSON.stringify({ schemaVersion: 1, paperId: review.paperId, sourceSha256: review.sourceSha256, approved: true, identityMatches: true, identityNotes: 'Synthetic fixture title page matches.', images: review.images.map(image => ({ imageId: image.imageId, sha256: image.sha256, legible: true, matchesDescription: true, claimsSupported: true, observedDetail: 'The synthetic diagram contains a rectangle and diagonal line.' })) }));
  console.log(JSON.stringify({ type: 'turn.completed' }));
  process.exit(0);
}
const c = JSON.parse(await fs.readFile('context.json', 'utf8'));
let calls = 0; try { calls = Number(await fs.readFile(path.join(d, c.paper.id + '.calls'), 'utf8')); } catch {}
calls++;
await fs.writeFile(path.join(d, c.paper.id + '.calls'), String(calls));
await fs.writeFile(path.join(d, c.paper.id + '.prompt-' + calls), prompt);
await fs.appendFile(path.join(d, 'worker-lifecycle.jsonl'), JSON.stringify({ paperId: c.paper.id, event: 'start' }) + '\\n');
await fs.writeFile(path.join(d, c.paper.id + '.started'), JSON.stringify(process.argv));
if (process.env.WAIT_WORKER === 'yes') while (true) {
  try { await fs.access(path.join(d, c.paper.id + '.release')); break; }
  catch { await new Promise(r => setTimeout(r, 20)); }
}
let plan = {}; try { plan = JSON.parse(await fs.readFile(path.join(d, c.paper.id + '.plan.json'), 'utf8')); } catch {}
const r = JSON.parse(await fs.readFile(path.join(d, 'template.json'), 'utf8'));
r.paperId = c.paper.id; r.generatedAt = c.generatedAt; r.sources = [c.primary]; r.relatedPaperIds = [];
r.taxonomy.recordedClassification = c.classification; r.reportStatus = 'partial-text-reviewed';
r.coverage = { ...r.coverage, scope: 'selected-sections', figuresReviewed: [], tablesReviewed: [], omissions: c.manifest.omissions };
await fs.writeFile('report.json', JSON.stringify(r));
await fs.writeFile('metadata.json', JSON.stringify({ title: c.manifest.observedTitle, authors: 'Fixture Author', sourceSha256: c.manifest.sha256, location: 'Title heading' }));
await fs.writeFile('source-audit.jsonl', c.config.chunks.map((x,i) => JSON.stringify({ operation: 'read', chunk: i + 1, sha256: x.sha256 })).join('\\n'));
await fs.writeFile('receipt.json', JSON.stringify({ schemaVersion: 1, paperId: c.paper.id, outcome: 'illustration-unavailable', reason: 'The supplied text has no PDF.', evidenceIds: calls <= (plan.invalidUntil || 0) ? ['missing-evidence'] : [r.evidence[0].id], baseReportPath: 'report.json', editionPath: null, metadataPath: 'metadata.json' }));
await fs.appendFile(path.join(d, 'worker-lifecycle.jsonl'), JSON.stringify({ paperId: c.paper.id, event: 'finish' }) + '\\n');
console.log(JSON.stringify({ type: 'turn.completed' }));
`);
  await chmod(fake, 0o755);
  function run(extra = [], wait = false) {
    const child = spawn(process.execPath, [join(repo, 'scripts/reading/run-illustrated.mjs'), '--work-dir', work, ...extra], { env: { ...process.env, CODEX_BIN: fake, ILLUSTRATED_CONTROL: control, WAIT_WORKER: wait ? 'yes' : 'no' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', bytes => output += bytes); child.stderr.on('data', bytes => output += bytes);
    const completion = new Promise(resolve => child.on('close', code => resolve({ code, output })));
    t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
    return { child, completion };
  }
  return { root, repo, work, control, run };
}
async function retainedDraft(f, id, complete = true) {
  const paper = (await readJSON(join(f.repo, 'data/papers.json'))).find(paper => paper.id === id);
  const manifest = await readJSON(join(f.work, 'sources', id, 'manifest.json'));
  const attempt = join(await realpath(f.work), 'illustrated-runs', id, 'attempts', 'retained-fixture');
  const config = await snapshotSource({ attempt, manifest, repository: f.repo });
  const primary = { id: 'primary', url: manifest.canonicalUrl, title: manifest.observedTitle, kind: manifest.kind, sha256: manifest.sha256, wordCount: manifest.wordCount, accessedAt: manifest.accessedAt };
  const context = { paper, manifest, config, primary, classification: classificationSnapshot(paper, date), generatedAt: date, repository: f.repo };
  const report = structuredClone(template);
  report.paperId = id; report.generatedAt = date; report.sources = [primary]; report.relatedPaperIds = [];
  report.taxonomy.recordedClassification = context.classification; report.reportStatus = 'partial-text-reviewed';
  report.coverage = { ...report.coverage, scope: 'selected-sections', figuresReviewed: [], tablesReviewed: [], omissions: manifest.omissions };
  await writeJSON(join(attempt, 'context.json'), context);
  await writeJSON(join(attempt, 'report.json'), report);
  await writeJSON(join(attempt, 'metadata.json'), { title: manifest.observedTitle, authors: 'Fixture Author', sourceSha256: manifest.sha256, location: 'Title heading' });
  if (complete) await writeJSON(join(attempt, 'receipt.json'), { schemaVersion: 1, paperId: id, outcome: 'illustration-unavailable', reason: 'The supplied text has no PDF.', evidenceIds: [report.evidence[0].id], baseReportPath: 'report.json', editionPath: null, metadataPath: 'metadata.json' });
  await writeFile(join(attempt, 'events.jsonl'), '');
  await writeFile(join(attempt, 'source-audit.jsonl'), config.chunks.map((chunk, index) => JSON.stringify({ operation: 'read', chunk: index + 1, sha256: chunk.sha256 })).join('\n'));
  await writeJSON(join(f.work, 'illustrated-runs', id, 'status.json'), { schemaVersion: 1, paperId: id, state: 'error', phase: 'validation', attempt, generatedAt: date, sourceSha256: manifest.sha256, textSha256: manifest.textSha256, error: 'Retained test draft awaits validation.', validationRepairs: 0 });
  return { attempt, context, report, manifest };
}
async function retainedPdfDraft(t, f) {
  const pdf = await fixture(t, true), id = pdf.context.paper.id;
  const sourceDirectory = join(await realpath(f.work), 'sources', id);
  const manifest = { ...pdf.manifest, sourcePath: join(sourceDirectory, 'original.pdf'), textPath: join(sourceDirectory, 'text.txt') };
  await cp(pdf.manifest.sourcePath, manifest.sourcePath);
  await cp(pdf.manifest.textPath, manifest.textPath);
  await writeJSON(join(sourceDirectory, 'manifest.json'), manifest);
  const attempt = join(await realpath(f.work), 'illustrated-runs', id, 'attempts', 'retained-pdf-fixture');
  const config = await snapshotSource({ attempt, manifest, repository: f.repo });
  const paper = (await readJSON(join(f.repo, 'data/papers.json'))).find(paper => paper.id === id);
  const context = { paper, manifest, config, primary: pdf.report.sources[0], classification: classificationSnapshot(paper, date), generatedAt: date, repository: f.repo };
  for (const name of ['report.json', 'edition.json', 'metadata.json', 'receipt.json', 'source-audit.jsonl', 'events.jsonl', 'renders', 'assets']) await cp(join(pdf.attempt, name), join(attempt, name), { recursive: true });
  await writeJSON(join(attempt, 'context.json'), context);
  await writeJSON(join(f.work, 'illustrated-runs', id, 'status.json'), { schemaVersion: 1, paperId: id, state: 'error', phase: 'validation', attempt, generatedAt: date, sourceSha256: manifest.sha256, textSha256: manifest.textSha256, error: 'Retained synthetic PDF awaits independent review.', validationRepairs: 0 });
  return { attempt, context, manifest };
}
async function until(predicate) { const start = Date.now(); while (!await predicate()) { if (Date.now() - start > 15_000) throw new Error('Timed out waiting for fixture worker'); await new Promise(resolve => setTimeout(resolve, 30)); } }
test('review policy reaches the independent reviewer with distinct page and crop roles and invalidates older cached policy', async t => {
  const f = await runnerFixture(t, ['fixture']);
  const draft = await retainedPdfDraft(t, f);
  const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
  assert.equal(result.code, 0, result.output);
  assert.equal(await exists(join(f.control, 'fixture.calls')), false, 'The supplied PDF draft must not invoke a new writer.');
  assert.equal(await readFile(join(f.control, 'fixture.review-calls'), 'utf8'), '1');
  const referencePath = join(draft.attempt, 'visual-review-reference.json');
  const reference = await readJSON(referencePath);
  const contextPath = join(reference.directory, 'review-context.json');
  const context = await readJSON(contextPath);
  assert.equal(reference.policyVersion, 'wam-visual-evidence-v2');
  assert.equal(reference.reviewContextSha256, await fileHash(contextPath));
  assert.deepEqual(context.policy, {
    version: 'wam-visual-evidence-v2',
    reviewerRole: 'independent-visual-evidence-reviewer',
    sourcePageLegibility: 'Relevant title/identity and evidence regions needed for the report claims or selected-crop verification must be readable. Disclose unrelated unused source defects; those defects alone do not make the page insufficient.',
    finalCropLegibility: 'Important labels, axes, legends, table headers and relevant footnotes needed to interpret the selected final crop must be readable. Never infer hidden values or waive unsupported claims.'
  });
  assert.deepEqual(context.images.map(({ kind, reviewRole }) => ({ kind, reviewRole })), [
    { kind: 'source-page', reviewRole: 'supporting-source-page' },
    { kind: 'crop', reviewRole: 'selected-final-crop' }
  ]);
  const prompt = await readFile(join(f.control, 'fixture.review-prompt-1'), 'utf8');
  assert.ok(prompt.includes(JSON.stringify(context)), 'The actual reviewer prompt must receive the versioned policy and image roles.');
  const args = JSON.parse(await readFile(join(f.control, 'fixture.review-args-1'), 'utf8'));
  assert.ok(args.includes('read-only'));
  const attachments = args.flatMap((value, index) => value === '--image' ? [args[index + 1]] : []);
  assert.equal(attachments.length, context.images.length);
  for (const [index, path] of attachments.entries()) assert.equal(await fileHash(path), context.images[index].sha256);
  const statusPath = join(f.work, 'illustrated-runs/fixture/status.json');
  const status = await readJSON(statusPath);
  assert.equal(status.state, 'complete');

  // A receipt accepted under an earlier scope policy must not silently satisfy
  // the new policy, even when all source and crop hashes remain unchanged.
  const oldContext = structuredClone(context); oldContext.policy.version = 'wam-visual-evidence-v1';
  await writeJSON(contextPath, oldContext);
  await writeJSON(referencePath, { ...reference, policyVersion: oldContext.policy.version, reviewContextSha256: await fileHash(contextPath) });
  await writeJSON(statusPath, { ...status, state: 'publishing', phase: 'publishing' });
  const recovered = await f.run().completion;
  assert.equal(recovered.code, 0, recovered.output);
  assert.equal(await readFile(join(f.control, 'fixture.review-calls'), 'utf8'), '2');
  assert.equal(await exists(join(f.control, 'fixture.calls')), false);
  const fresh = await readJSON(referencePath);
  assert.notEqual(fresh.directory, reference.directory);
  const freshContextPath = join(fresh.directory, 'review-context.json');
  const freshContext = await readJSON(freshContextPath);
  assert.deepEqual(freshContext.policy, context.policy);
  assert.equal(fresh.policyVersion, context.policy.version);
  assert.equal(fresh.reviewContextSha256, await fileHash(freshContextPath));
  assert.equal((await readJSON(contextPath)).policy.version, 'wam-visual-evidence-v1', 'The previous review evidence must remain intact.');
  assert.equal((await readJSON(statusPath)).state, 'complete');

  // Unlike an intact older policy, a changed hashed context is an integrity
  // failure; it cannot launch either a new reviewer or a corrective writer.
  await writeJSON(freshContextPath, { ...freshContext, title: 'Tampered reviewer identity' });
  await writeJSON(statusPath, { ...await readJSON(statusPath), state: 'publishing', phase: 'publishing' });
  const tampered = await f.run().completion;
  assert.equal(tampered.code, 1, tampered.output);
  assert.match((await readJSON(statusPath)).error, /Cached visual-review context fingerprint changed/);
  assert.equal(await readFile(join(f.control, 'fixture.review-calls'), 'utf8'), '2');
  assert.equal(await exists(join(f.control, 'fixture.calls')), false);
});
test('concurrency defaults to one and accepts only one through four slots', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  for (const concurrency of [undefined, 1, 2, 3, 4]) {
    const result = await f.run(['--dry-run', ...(concurrency === undefined ? [] : ['--concurrency', String(concurrency)])]).completion;
    assert.equal(result.code, 0, result.output);
    assert.equal(JSON.parse(result.output).concurrency, concurrency ?? 1);
  }
  for (const concurrency of [0, 5, 1.5]) {
    const result = await f.run(['--dry-run', '--concurrency', String(concurrency)]).completion;
    assert.equal(result.code, 1, result.output);
  }
  assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
});
test('complete failed drafts resume validation without another writer or changed provenance', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const draft = await retainedDraft(f, 'fixture-a');
  const before = await fileHash(join(draft.attempt, 'report.json'));
  const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
  assert.equal(result.code, 0, result.output);
  assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
  const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
  assert.equal(status.state, 'illustration-unavailable');
  assert.equal(status.attempt, draft.attempt);
  assert.equal(status.recoveredDraft, true);
  assert.equal(status.validationRepairs, 0);
  assert.equal(status.generatedAt, date);
  assert.equal(status.sourceSha256, draft.manifest.sha256);
  assert.equal(status.textSha256, draft.manifest.textSha256);
  const published = await readJSON(join(f.repo, 'data/reports/fixture-a.json'));
  assert.equal(published.generatedAt, date);
  assert.deepEqual(published.sources, draft.report.sources);
  assert.deepEqual(published.taxonomy.recordedClassification, draft.context.classification);
  assert.equal(await fileHash(join(draft.attempt, 'report.json')), before);
});
test('an incomplete retained draft starts a fresh writer instead of fabricating completion', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const draft = await retainedDraft(f, 'fixture-a', false);
  const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
  assert.equal(result.code, 0, result.output);
  assert.equal(await readFile(join(f.control, 'fixture-a.calls'), 'utf8'), '1');
  const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
  assert.equal(status.state, 'illustration-unavailable');
  assert.notEqual(status.attempt, draft.attempt);
  assert.equal(status.recoveredDraft, false);
  assert.equal(await exists(join(draft.attempt, 'receipt.json')), false);
});
for (const [field, value] of [['python', '/tmp/untrusted-reader-python'], ['pdftoppm', '/tmp/untrusted-reader-pdftoppm'], ['sourceFile', 'alternate-source.raw']]) {
  test(`retained drafts cannot substitute the trusted ${field}`, async t => {
    const f = await runnerFixture(t, ['fixture-a']);
    const draft = await retainedDraft(f, 'fixture-a');
    const context = await readJSON(join(draft.attempt, 'context.json'));
    context.config[field] = value;
    await writeJSON(join(draft.attempt, 'context.json'), context);
    await writeJSON(join(draft.attempt, 'source-config.json'), context.config);
    const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
    assert.equal(result.code, 1, result.output);
    const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
    assert.equal(status.state, 'error');
    assert.match(status.error, /Untrusted retained source configuration/);
    assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
    assert.equal(await exists(join(f.repo, 'data/reports/fixture-a.json')), false);
  });
}
test('matching edits to both retained configs cannot hide unread source chunks', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const manifestPath = join(f.work, 'sources/fixture-a/manifest.json');
  const manifest = await readJSON(manifestPath);
  const fullText = 'Verified primary source with distinct complete section coverage.\n'.repeat(600);
  await writeFile(manifest.textPath, fullText);
  manifest.sha256 = manifest.textSha256 = await fileHash(manifest.textPath);
  manifest.wordCount = fullText.trim().split(/\s+/).length;
  await writeJSON(manifestPath, manifest);
  const draft = await retainedDraft(f, 'fixture-a');
  const context = await readJSON(join(draft.attempt, 'context.json'));
  assert.ok(context.config.chunks.length > 1);
  context.config.chunks.pop();
  await writeJSON(join(draft.attempt, 'context.json'), context);
  await writeJSON(join(draft.attempt, 'source-config.json'), context.config);
  const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
  assert.equal(result.code, 1, result.output);
  const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
  assert.equal(status.state, 'error');
  assert.match(status.error, /Retained text chunk inventory changed/);
  assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
  assert.equal(await exists(join(f.repo, 'data/reports/fixture-a.json')), false);
  assert.equal(await fileHash(join(draft.attempt, 'source.raw')), manifest.sha256);
  assert.equal(await fileHash(join(draft.attempt, 'source.txt')), manifest.textSha256);
});
test('three consecutive failures stop scheduling while an active reader may finish publishing', async t => {
  const f = await runnerFixture(t, ['fixture-active', 'fixture-bad1', 'fixture-bad2', 'fixture-bad3', 'fixture-pending']);
  for (const id of ['fixture-bad1', 'fixture-bad2', 'fixture-bad3']) await writeFile(join(f.work, 'sources', id, 'source.txt'), 'changed fingerprint');
  const running = f.run(['--concurrency', '2'], true);
  await until(async () => await exists(join(f.control, 'fixture-active.started')) && await exists(join(f.work, 'illustrated-runs/fixture-bad3/status.json')));
  await writeFile(join(f.control, 'fixture-active.release'), '');
  const result = await running.completion;
  assert.equal(result.code, 1, result.output);
  const active = await readJSON(join(f.work, 'illustrated-runs/fixture-active/status.json'));
  assert.equal(active.state, 'illustration-unavailable', result.output);
  assert.equal(await exists(join(f.repo, 'data/reports/fixture-active.json')), true);
  assert.equal(await exists(join(f.control, 'fixture-pending.started')), false);
  for (const id of ['fixture-bad1', 'fixture-bad2', 'fixture-bad3']) assert.equal((await readJSON(join(f.work, 'illustrated-runs', id, 'status.json'))).state, 'error');
  assert.match(result.output, /"interrupted":false/);
  assert.equal(await exists(join(f.work, 'illustrated-runs/illustrated.lock')), false);
});
test('one feedback repair can correct validation and preserves the first worker evidence', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  await writeJSON(join(f.control, 'fixture-a.plan.json'), { invalidUntil: 1 });
  const result = await f.run().completion;
  assert.equal(result.code, 0, result.output);
  assert.equal(await readFile(join(f.control, 'fixture-a.calls'), 'utf8'), '2');
  const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
  assert.equal(status.state, 'illustration-unavailable');
  assert.equal(status.validationRepairs, 1);
  const feedback = await readFile(join(f.control, 'fixture-a.prompt-2'), 'utf8');
  assert.match(feedback, /Unresolved receipt evidence/);
  const history = await readdir(join(status.attempt, 'worker-history'), { recursive: true });
  const receipt = history.find(name => name.endsWith('receipt.json'));
  assert.ok(receipt, 'The first worker receipt must remain in private history.');
  assert.deepEqual((await readJSON(join(status.attempt, 'worker-history', receipt))).evidenceIds, ['missing-evidence']);
  assert.ok(history.some(name => name.endsWith('events.jsonl')));
});
for (const name of ['source-tool.py', 'SKILL.md', 'report-guide.md', 'illustrated-report-guide.md', 'worker-history', 'tmp', 'prompt.txt', 'events.jsonl', 'stderr.log']) {
  test(`feedback repair rejects a symlinked ${name} before any outside write`, async t => {
    const f = await runnerFixture(t, ['fixture-a']);
    const draft = await retainedDraft(f, 'fixture-a');
    const receiptPath = join(draft.attempt, 'receipt.json');
    const receipt = await readJSON(receiptPath);
    receipt.evidenceIds = ['missing-evidence'];
    await writeJSON(receiptPath, receipt);
    // Missing events must not disable validation of the other reused paths.
    await rm(join(draft.attempt, 'events.jsonl'));
    const outside = join(f.control, 'outside');
    const directory = ['worker-history', 'tmp'].includes(name);
    if (directory) await mkdir(outside);
    const sentinel = directory ? join(outside, 'sentinel.txt') : outside;
    await writeFile(sentinel, 'outside must remain unchanged');
    await rm(join(draft.attempt, name), { force: true });
    await symlink(outside, join(draft.attempt, name));
    const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
    assert.equal(result.code, 1, result.output);
    const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
    assert.match(status.error, /Symlink/);
    assert.equal(await readFile(sentinel, 'utf8'), 'outside must remain unchanged');
    if (directory) assert.deepEqual(await readdir(outside), ['sentinel.txt']);
    assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
    assert.equal(await exists(join(f.repo, 'data/reports/fixture-a.json')), false);
  });
}
test('feedback repair rejects dangling links and hard-linked helper destinations', async t => {
  for (const kind of ['dangling', 'hard']) {
    const f = await runnerFixture(t, ['fixture-a']);
    const draft = await retainedDraft(f, 'fixture-a');
    const receiptPath = join(draft.attempt, 'receipt.json');
    await writeJSON(receiptPath, { ...await readJSON(receiptPath), evidenceIds: ['missing-evidence'] });
    const helper = join(draft.attempt, 'source-tool.py'), outside = join(f.control, 'outside');
    await rm(helper);
    if (kind === 'dangling') await symlink(outside, helper);
    else { await writeFile(outside, 'outside must remain unchanged'); await link(outside, helper); }
    const result = await f.run(['--retry-errors', '--resume-drafts']).completion;
    assert.equal(result.code, 1, result.output);
    const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
    assert.match(status.error, kind === 'dangling' ? /Symlink/ : /hard links/);
    if (kind === 'dangling') assert.equal(await exists(outside), false);
    else assert.equal(await readFile(outside, 'utf8'), 'outside must remain unchanged');
    assert.equal(await exists(join(f.control, 'fixture-a.started')), false);
  }
});
test('a still-invalid feedback repair fails after two writer calls without publication', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  await writeJSON(join(f.control, 'fixture-a.plan.json'), { invalidUntil: 100 });
  const result = await f.run().completion;
  assert.equal(result.code, 1, result.output);
  assert.equal(await readFile(join(f.control, 'fixture-a.calls'), 'utf8'), '2');
  const status = await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'));
  assert.equal(status.state, 'error');
  assert.equal(status.validationRepairs, 1);
  assert.match(status.error, /Unresolved receipt evidence/);
  assert.equal(await exists(join(f.repo, 'data/reports/fixture-a.json')), false);
  assert.equal(await exists(join(f.work, 'illustrated-runs/illustrated.lock')), false);
});
test('mock workers drain, resume and preserve unavailable outcomes without repeating model work', async t => {
  const f = await runnerFixture(t);
  const first = f.run(['--concurrency', '2'], true);
  await until(async () => await exists(join(f.control, 'fixture-a.started')) && await exists(join(f.control, 'fixture-b.started')));
  first.child.kill('SIGUSR1');
  await new Promise(resolve => setTimeout(resolve, 50));
  await writeFile(join(f.control, 'fixture-a.release'), ''); await writeFile(join(f.control, 'fixture-b.release'), '');
  const initial = await first.completion; assert.equal(initial.code, 0, initial.output);
  assert.equal(await exists(join(f.control, 'fixture-c.started')), false);
  const second = await f.run().completion; assert.equal(second.code, 0, second.output);
  assert.equal(await exists(join(f.control, 'fixture-c.started')), true);
  const third = await f.run().completion; assert.match(third.output, /"scheduled":0/);
  const argumentsUsed = JSON.parse(await readFile(join(f.control, 'fixture-a.started'), 'utf8'));
  assert.ok(argumentsUsed.includes('workspace-write')); assert.ok(!argumentsUsed.includes('--model')); assert.ok(argumentsUsed.includes('sandbox_workspace_write.network_access=false'));
});
for (const concurrency of [2, 4]) {
  test(`${concurrency} slots refill after accepted publication while other readers stay busy and respect the limit`, async t => {
    const ids = Array.from({ length: concurrency + 2 }, (_, index) => `fixture-${index + 1}`);
    const initialIds = ids.slice(0, concurrency), nextId = ids[concurrency], excludedId = ids[concurrency + 1];
    const f = await runnerFixture(t, ids);
    const reportsPath = join(f.repo, 'scripts/lib/reports.mjs');
    const source = await readFile(reportsPath, 'utf8');
    await writeFile(reportsPath, source.replace('export async function updateReadingIndex({ repository, workDir }) {', `export async function updateReadingIndex({ repository, workDir }) {
      await writeFile(join(process.env.ILLUSTRATED_CONTROL, 'index-started'), '');
      while (true) {
        try { await readFile(join(process.env.ILLUSTRATED_CONTROL, 'release-index')); break; }
        catch { await new Promise(resolve => setTimeout(resolve, 20)); }
      }
    `));
    const running = f.run(['--concurrency', String(concurrency), '--limit', String(concurrency + 1)], true);
    await until(async () => (await Promise.all(initialIds.map(id => exists(join(f.control, `${id}.started`))))).every(Boolean));
    assert.equal(await exists(join(f.control, `${nextId}.started`)), false);
    await writeFile(join(f.control, `${initialIds[0]}.release`), '');
    await until(() => exists(join(f.control, 'index-started')));
    assert.equal((await readJSON(join(f.work, 'illustrated-runs', initialIds[0], 'status.json'))).state, 'publishing');
    assert.equal(await exists(join(f.control, `${nextId}.started`)), false, 'A finished writer still occupies its slot until accepted publication and index refresh finish.');
    await writeFile(join(f.control, 'release-index'), '');
    await until(() => exists(join(f.control, `${nextId}.started`)));
    assert.equal((await readJSON(join(f.work, 'illustrated-runs', initialIds[0], 'status.json'))).state, 'illustration-unavailable');
    const index = await readJSON(join(f.repo, 'data/reading-index.json'));
    assert.equal(index.entries.find(entry => entry.paperId === initialIds[0]).readingStatus, 'partial');
    for (const id of initialIds.slice(1)) {
      assert.equal((await readJSON(join(f.work, 'illustrated-runs', id, 'status.json'))).state, 'running');
      assert.equal(index.entries.find(entry => entry.paperId === id).readingStatus, 'queued');
    }
    await writeFile(join(f.control, `${nextId}.release`), '');
    await until(async () => (await readJSON(join(f.work, 'illustrated-runs', nextId, 'status.json'))).state === 'illustration-unavailable');
    assert.equal(await exists(join(f.control, `${excludedId}.started`)), false);
    await Promise.all(initialIds.slice(1).map(id => writeFile(join(f.control, `${id}.release`), '')));
    const result = await running.completion;
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, new RegExp(`"scheduled":${concurrency + 1}`));
    assert.equal(await exists(join(f.control, `${excludedId}.started`)), false);
    const live = new Set(); let peak = 0;
    for (const event of (await readFile(join(f.control, 'worker-lifecycle.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)) {
      if (event.event === 'start') { live.add(event.paperId); peak = Math.max(peak, live.size); }
      else assert.equal(live.delete(event.paperId), true);
    }
    assert.equal(peak, concurrency);
    assert.equal(live.size, 0);
    const metadata = await readJSON(join(f.repo, 'data/illustrated-report-metadata.json'));
    assert.deepEqual(Object.keys(metadata).sort(), ids.slice(0, concurrency + 1).sort());
  });
}
test('new and recovered publications serialize the whole bundle with reading-index updates', async t => {
  const f = await runnerFixture(t, ['fixture-a', 'fixture-b', 'fixture-c']);
  const draft = await retainedDraft(f, 'fixture-b');
  const statusPath = join(f.work, 'illustrated-runs/fixture-b/status.json');
  await writeJSON(statusPath, { ...await readJSON(statusPath), state: 'publishing', phase: 'publishing' });
  // Delay the real fixture mutations and reject overlap across both modules.
  // This also catches an index snapshot taken halfway through another bundle.
  await writeFile(join(f.repo, 'scripts/lib/write-test-guard.mjs'), `
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
let busy = false;
export async function guardedWrite(name, action) {
  if (busy) throw new Error('Concurrent repository mutation: ' + name);
  busy = true;
  const trace = join(process.env.ILLUSTRATED_CONTROL, 'repository-writes.jsonl');
  await appendFile(trace, JSON.stringify({ name, event: 'start' }) + '\\n');
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    return await action();
  } finally {
    await appendFile(trace, JSON.stringify({ name, event: 'finish' }) + '\\n');
    busy = false;
  }
}
`);
  for (const [file, name] of [['illustrated-runner.mjs', 'publishBundle'], ['reports.mjs', 'updateReadingIndex']]) {
    const path = join(f.repo, 'scripts/lib', file);
    const source = await readFile(path, 'utf8');
    const declaration = `export async function ${name}(`;
    assert.ok(source.includes(declaration));
    await writeFile(path, `import { guardedWrite } from './write-test-guard.mjs';\n` + source.replace(declaration, `export async function ${name}(...args) { return guardedWrite('${name}', () => ${name}Impl(...args)); }\nasync function ${name}Impl(`));
  }
  const result = await f.run(['--concurrency', '2']).completion;
  assert.equal(result.code, 0, result.output);
  assert.equal(await exists(join(f.control, 'fixture-b.started')), false);
  const recovered = await readJSON(statusPath);
  assert.equal(recovered.state, 'illustration-unavailable');
  assert.equal(recovered.phase, 'complete');
  assert.equal(recovered.attempt, draft.attempt);
  const events = (await readFile(join(f.control, 'repository-writes.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(events.filter(event => event.name === 'publishBundle' && event.event === 'start').length, 3);
  assert.ok(events.some(event => event.name === 'updateReadingIndex'));
  for (let i = 0; i < events.length; i += 2) {
    assert.equal(events[i].event, 'start');
    assert.deepEqual(events[i + 1], { name: events[i].name, event: 'finish' });
  }
  const index = await readJSON(join(f.repo, 'data/reading-index.json'));
  assert.ok(index.entries.every(entry => entry.readingStatus === 'partial'));
  const metadata = await readJSON(join(f.repo, 'data/illustrated-report-metadata.json'));
  assert.deepEqual(Object.keys(metadata).sort(), ['fixture-a', 'fixture-b', 'fixture-c']);
});
test('index failures retain accepted publication context across retries without another reader', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const reportsPath = join(f.repo, 'scripts/lib/reports.mjs');
  const source = await readFile(reportsPath, 'utf8');
  await writeFile(reportsPath, source.replace('export async function updateReadingIndex({ repository, workDir }) {', `export async function updateReadingIndex({ repository, workDir }) {
    try { await readFile(join(process.env.ILLUSTRATED_CONTROL, 'allow-index')); }
    catch { throw new Error('Injected reading-index failure'); }
  `));
  const first = await f.run().completion;
  assert.equal(first.code, 1, first.output);
  const statusPath = join(f.work, 'illustrated-runs/fixture-a/status.json');
  const initial = await readJSON(statusPath);
  assert.equal(initial.state, 'error');
  assert.equal(initial.phase, 'publishing');
  assert.match(initial.error, /Injected reading-index failure/);
  assert.ok(initial.files.length);
  const reportPath = join(f.repo, 'data/reports/fixture-a.json');
  const acceptedHash = await fileHash(reportPath);
  const second = await f.run(['--retry-errors']).completion;
  assert.equal(second.code, 1, second.output);
  const retried = await readJSON(statusPath);
  assert.equal(retried.phase, 'publishing');
  assert.equal(retried.attempt, initial.attempt);
  assert.deepEqual(retried.files, initial.files);
  assert.equal(await readFile(join(f.control, 'fixture-a.calls'), 'utf8'), '1');
  await writeFile(join(f.control, 'allow-index'), '');
  const third = await f.run(['--retry-errors']).completion;
  assert.equal(third.code, 0, third.output);
  const recovered = await readJSON(statusPath);
  assert.equal(recovered.state, 'illustration-unavailable');
  assert.equal(recovered.phase, 'complete');
  assert.equal(recovered.attempt, initial.attempt);
  assert.equal(await readFile(join(f.control, 'fixture-a.calls'), 'utf8'), '1');
  assert.equal(await fileHash(reportPath), acceptedHash);
  assert.equal((await readJSON(join(f.repo, 'data/reading-index.json'))).entries[0].readingStatus, 'partial');
});
test('preflight hash failure is private and does not prevent the next readable paper', async t => {
  const f = await runnerFixture(t, ['fixture-a', 'fixture-b']);
  await writeFile(join(f.work, 'sources/fixture-a/source.txt'), 'tampered');
  const result = await f.run().completion;
  assert.equal(result.code, 1, result.output);
  assert.equal((await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'))).state, 'error');
  assert.equal((await readJSON(join(f.work, 'illustrated-runs/fixture-b/status.json'))).state, 'illustration-unavailable');
  assert.equal(await exists(join(f.work, 'illustrated-runs/illustrated.lock')), false);
});
test('interrupt releases the lock only after readers stop and a later run resumes', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const first = f.run([], true);
  await until(() => exists(join(f.control, 'fixture-a.started')));
  const locked = await f.run().completion;
  assert.notEqual(locked.code, 0); assert.match(locked.output, /runner is locked/);
  first.child.kill('SIGTERM');
  const stopped = await first.completion;
  assert.equal(stopped.code, 130, stopped.output);
  assert.equal((await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'))).state, 'interrupted');
  assert.equal(await exists(join(f.work, 'illustrated-runs/illustrated.lock')), false);
  const resumed = await f.run().completion; assert.equal(resumed.code, 0, resumed.output);
});
test('timeouts record recoverable errors without publication', async t => {
  const f = await runnerFixture(t, ['fixture-a']);
  const result = await f.run(['--timeout-minutes', '.005'], true).completion;
  assert.equal(result.code, 1, result.output);
  assert.equal((await readJSON(join(f.work, 'illustrated-runs/fixture-a/status.json'))).state, 'error');
  assert.equal(await exists(join(f.repo, 'data/reports/fixture-a.json')), false);
});
