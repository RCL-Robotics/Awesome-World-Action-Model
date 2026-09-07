import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm, symlink, link, chmod } from 'node:fs/promises';
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
    for (const change of [r => r.approved = false, r => r.images.pop(), r => r.images[0].sha256 = '0'.repeat(64), r => r.images[0].legible = false, r => r.images[0].claimsSupported = false, r => r.identityMatches = false]) {
      const bad = structuredClone(review); change(bad); assert.throws(() => validateVisualReview(bad, expected), /reviewer rejected/);
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
  await writeFile(fake, `#!${process.execPath}\nimport fs from 'node:fs/promises';import path from 'node:path';\nconst c=JSON.parse(await fs.readFile('context.json','utf8')), d=process.env.ILLUSTRATED_CONTROL;\nawait fs.writeFile(path.join(d,c.paper.id+'.started'),JSON.stringify(process.argv));\nif(process.env.WAIT_WORKER==='yes')while(true){try{await fs.access(path.join(d,c.paper.id+'.release'));break}catch{await new Promise(r=>setTimeout(r,20))}}\nconst r=JSON.parse(await fs.readFile(path.join(d,'template.json'),'utf8'));r.paperId=c.paper.id;r.generatedAt=c.generatedAt;r.sources=[c.primary];r.relatedPaperIds=[];r.taxonomy.recordedClassification=c.classification;r.reportStatus='partial-text-reviewed';r.coverage={...r.coverage,scope:'selected-sections',figuresReviewed:[],tablesReviewed:[],omissions:c.manifest.omissions};\nawait fs.writeFile('report.json',JSON.stringify(r));await fs.writeFile('metadata.json',JSON.stringify({title:c.manifest.observedTitle,authors:'Fixture Author',sourceSha256:c.manifest.sha256,location:'Title heading'}));\nawait fs.writeFile('source-audit.jsonl',c.config.chunks.map((x,i)=>JSON.stringify({operation:'read',chunk:i+1,sha256:x.sha256})).join('\\n'));\nawait fs.writeFile('receipt.json',JSON.stringify({schemaVersion:1,paperId:c.paper.id,outcome:'illustration-unavailable',reason:'The supplied text has no PDF.',evidenceIds:[r.evidence[0].id],baseReportPath:'report.json',editionPath:null,metadataPath:'metadata.json'}));console.log(JSON.stringify({type:'turn.completed'}));\n`);
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
async function until(predicate) { const start = Date.now(); while (!await predicate()) { if (Date.now() - start > 15_000) throw new Error('Timed out waiting for fixture worker'); await new Promise(resolve => setTimeout(resolve, 30)); } }
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
