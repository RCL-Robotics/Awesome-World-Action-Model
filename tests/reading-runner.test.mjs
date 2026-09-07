import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, chmod, readdir, rm, symlink, unlink, access } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const repository = fileURLToPath(new URL('../', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const put = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value)); };
async function waitFor(check, message, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await pause(20); }
  throw new Error(message);
}
const fakeCli = `#!/usr/bin/env node
import fs from 'node:fs';
import { join } from 'node:path';
const control=process.env.WAM_TEST_CONTROL;
process.on('SIGTERM',()=>{fs.writeFileSync(join(control,'term-'+process.pid),'');if(!process.env.WAM_TEST_STUBBORN)process.exit(143);});
setTimeout(()=>process.exit(9),15000).unref();
let prompt='';for await(const chunk of process.stdin)prompt+=chunk;
const record=heading=>JSON.parse(prompt.split(heading+'\\n')[1].split('\\n')[0]);
const paper=record('CATALOG IDENTITY');
const source=record('REQUIRED PRIMARY SOURCE PROVENANCE (copy exactly; no guessed dates or hashes)');
const scope=record('ACQUISITION SCOPE');
fs.appendFileSync(join(control,'invocations.jsonl'),JSON.stringify({id:paper.id,pid:process.pid,scope})+'\\n');
fs.writeFileSync(join(control,'started-'+paper.id),String(process.pid));
while(!process.env.WAM_TEST_AUTO&&!fs.existsSync(join(control,'release-'+paper.id)))await new Promise(r=>setTimeout(r,20));
const readingScope=scope.scope==='resource-overview'?'resource-overview':scope.scope==='abstract-only'?'abstract-only':scope.accessStatus==='partial-text'?'selected-sections':'full-paper';
const status=readingScope==='resource-overview'?'resource-reviewed':readingScope==='full-paper'?'full-text-reviewed':'partial-text-reviewed';
const claim=()=>({text:'A source-grounded integration fixture.',kind:'source',evidenceIds:['e1']});
const report={schemaVersion:1,paperId:paper.id,reportStatus:status,resourceType:readingScope==='resource-overview'?'technical-resource':'paper',generatedAt:new Date().toISOString(),sources:[source],coverage:{scope:readingScope,sectionsRead:[readingScope==='abstract-only'?'Abstract':'Introduction'],omissions:[],identityVerified:true,figuresReviewed:[],tablesReviewed:[],appendix:'not-present'},synopsis:'Integration fixture only.',readingTimeMinutes:1,problem:claim(),contributions:[claim()],method:{inputs:[],outputs:[],steps:[],training:[],inference:[],equations:[]},results:[],limitations:[],reproduction:[],taxonomy:{assessment:'unclear',reasoning:claim(),recordedClassification:{}},discussionQuestions:[],relatedPaperIds:[],evidence:[{id:'e1',sourceId:'primary',location:'Introduction',detail:'Fixture source material.'}]};
const output=process.argv[process.argv.indexOf('--output-last-message')+1];fs.writeFileSync(output,JSON.stringify(report));
`;
async function fixture(t, scopes = ['full-paper', 'full-paper', 'full-paper']) {
  const folder = await mkdtemp(join(tmpdir(), 'wam-runner-test-'));
  const repo = join(folder, 'repository'), work = join(folder, 'work'), control = join(folder, 'control');
  await mkdir(control, { recursive: true });
  const files = ['scripts/reading/run-reports.mjs', 'scripts/lib/reports.mjs', 'scripts/lib/data.mjs', 'scripts/lib/paths.mjs', 'src/lib/classification-snapshot.mjs', 'src/lib/taxonomy.mjs', 'schemas/reading-report.schema.json', 'skills/wam-paper-reader/SKILL.md', 'skills/wam-paper-reader/references/report-guide.md'];
  for (const file of files) { await mkdir(dirname(join(repo, file)), { recursive: true }); await copyFile(join(repository, file), join(repo, file)); }
  const papers = scopes.map((_, index) => ({ id: `fixture-${index}`, title: `Fixture paper ${index}`, authors: 'Example Author', venue: null, paperUrl: `https://example.org/paper-${index}`, majorCategory: 'WAM', subcategories: [], architecture: 'One Model', predictionParadigm: 'IDM', quadrant: 'Q2 · One Model × IDM', classificationStatus: null }));
  await put(join(repo, 'data/papers.json'), papers); await put(join(repo, 'data/meta.json'), { updatedAt: '2026-09-07T00:00:00Z' });
  // These isolated fixtures exercise lifecycle behavior after a review checkpoint.
  // The refusal test below changes only its isolated fixture back to awaiting review.
  await put(join(repo, 'data/report-pilot.json'), { state: 'approved', paperIds: [] });
  const text = 'Fixture source text.\n';
  for (const [index, paper] of papers.entries()) {
    const textPath = join(work, 'sources', paper.id, 'source.txt');
    await mkdir(dirname(textPath), { recursive: true }); await writeFile(textPath, text);
    await put(join(dirname(textPath), 'manifest.json'), { paperId: paper.id, accessStatus: scopes[index] === 'full-paper' ? 'full-text' : 'partial-text', scope: scopes[index], canonicalUrl: paper.paperUrl, observedTitle: paper.title, titleMatch: true, kind: 'text', sha256: 'a'.repeat(64), textSha256: createHash('sha256').update(text).digest('hex'), wordCount: 3, accessedAt: '2026-09-07T00:00:00Z', textPath, sectionsAvailable: [scopes[index] === 'abstract-only' ? 'Abstract' : 'Introduction'], omissions: ['Figure images were not supplied.'], identityNotes: ['The fixture source identity was checked.'] });
  }
  const binary = join(folder, 'fake-codex.mjs'); await writeFile(binary, fakeCli); await chmod(binary, 0o755);
  const children = [];
  function run(args = [], env = {}) {
    const child = spawn(process.execPath, [join(repo, 'scripts/reading/run-reports.mjs'), '--work-dir', work, ...args], { env: { ...process.env, CODEX_BIN: binary, WAM_TEST_CONTROL: control, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const state = { child, output: '', error: '', result: null };
    child.stdout.on('data', data => state.output += data); child.stderr.on('data', data => state.error += data);
    state.done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => { state.result = { code, signal }; resolve(state.result); }); });
    children.push(state); return state;
  }
  t.after(async () => {
    for (const state of children) if (!state.result) { state.child.kill('SIGTERM'); await Promise.race([state.done, pause(6500)]); if (!state.result) { state.child.kill('SIGKILL'); await state.done; } }
    await rm(folder, { recursive: true, force: true });
  });
  return { folder, repo, work, control, papers, text, run, started: id => exists(join(control, `started-${id}`)), release: id => writeFile(join(control, `release-${id}`), ''), lock: join(work, 'reading.lock') };
}

test('batch refuses to start while an isolated user review checkpoint is active', async t => {
  const f = await fixture(t, ['full-paper']);
  await put(join(f.repo, 'data/report-pilot.json'), { state: 'awaiting-user-review', paperIds: f.papers.map(paper => paper.id) });
  const run = f.run(['--limit', '1'], { WAM_TEST_AUTO: '1' });
  assert.equal((await run.done).code, 2, run.error);
  assert.match(run.error, /ten illustrated pilot reports require user review/);
  assert.equal(await exists(f.lock), false);
  assert.equal(await exists(join(f.control, 'invocations.jsonl')), false);
});

test('SIGUSR1 drains the active group, preserves the lock, and resumes only remaining entries', { timeout: 20000 }, async t => {
  const f = await fixture(t); const run = f.run(['--concurrency', '2']);
  await waitFor(async () => await f.started('fixture-0') && await f.started('fixture-1'), 'First group did not start');
  run.child.kill('SIGUSR1'); await waitFor(() => run.output.includes('Drain requested'), 'Drain signal was not handled');
  assert(await exists(f.lock)); assert.equal(await f.started('fixture-2'), false);
  await f.release('fixture-0'); await f.release('fixture-1');
  assert.equal((await run.done).code, 0, run.error); assert.equal(await exists(f.lock), false);
  const summary = JSON.parse(run.output.trim().split('\n').at(-1)); assert.equal(summary.drained, true); assert.equal(summary.completed, 2); assert.equal(summary.remainingCatalogEntries, 1);
  const index = await json(join(f.repo, 'data/reading-index.json')); assert.deepEqual(index.entries.map(e => e.readingStatus), ['reviewed', 'reviewed', 'queued']);
  const resumed = f.run([], { WAM_TEST_AUTO: '1' }); assert.equal((await resumed.done).code, 0, resumed.error);
  const invocations = (await readFile(join(f.control, 'invocations.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line).id);
  assert.deepEqual(invocations.sort(), ['fixture-0', 'fixture-1', 'fixture-2']);
});

test('a reader ignoring SIGTERM is force-stopped and remains resumable', { timeout: 20000 }, async t => {
  const f = await fixture(t, ['full-paper']); const run = f.run([], { WAM_TEST_STUBBORN: '1' });
  await waitFor(() => f.started('fixture-0'), 'Fake reader did not start');
  const startedAt = Date.now(); run.child.kill('SIGTERM');
  await waitFor(() => Boolean(run.result), 'Forced stop did not finish', 9000);
  assert.equal(run.result.code, 1, run.error); assert(Date.now() - startedAt >= 4500); assert.equal(await exists(f.lock), false);
  assert.equal((await json(join(f.work, 'runs/fixture-0.status.json'))).status, 'interrupted');
  assert.equal((await json(join(f.repo, 'data/reading-index.json'))).entries[0].readingStatus, 'queued');
});

test('an interrupt during source preflight prevents a later spawn', { timeout: 20000 }, async t => {
  const f = await fixture(t, ['full-paper']); const source = join(f.work, 'sources/fixture-0/source.txt');
  await unlink(source); execFileSync('mkfifo', [source]);
  const run = f.run(); await waitFor(() => exists(join(f.work, 'runs/fixture-0')), 'Preflight did not begin');
  run.child.kill('SIGTERM'); await waitFor(() => run.output.includes('Interrupt received'), 'Interrupt was not handled');
  await writeFile(source, f.text);
  assert.equal((await run.done).code, 1, run.error); assert.equal(await f.started('fixture-0'), false); assert.equal(await exists(f.lock), false);
});

test('acquisition scope and identity notes reach the prompt with the correct status precedence', { timeout: 20000 }, async t => {
  const f = await fixture(t, ['abstract-only', 'resource-overview', 'selected-sections']);
  const run = f.run([], { WAM_TEST_AUTO: '1' }); assert.equal((await run.done).code, 0, run.error);
  const statuses = [];
  for (const [i, scope] of ['abstract-only', 'resource-overview', 'selected-sections'].entries()) {
    const report = await json(join(f.repo, `data/reports/fixture-${i}.json`)); statuses.push(report.reportStatus); assert.equal(report.coverage.scope, scope);
    const prompt = await readFile(join(f.work, `runs/fixture-${i}/prompt.txt`), 'utf8'); assert(prompt.includes(`coverage.scope=${scope}`)); assert(prompt.includes('The fixture source identity was checked.'));
    assert(report.coverage.omissions.includes('Figure images were not supplied.'));
  }
  assert.deepEqual(statuses, ['partial-text-reviewed', 'resource-reviewed', 'partial-text-reviewed']);
});

test('the runner rejects repository caches, symlink escapes and fractional limits before writing', { timeout: 20000 }, async t => {
  const f = await fixture(t, ['full-paper']);
  const inside = join(f.repo, 'public/raw-reader'); const alias = join(f.folder, 'alias'); await symlink(join(f.repo, 'public'), alias);
  await mkdir(join(f.repo, 'public'), { recursive: true });
  for (const path of [inside, join(alias, 'raw-reader')]) {
    // The last --work-dir is not used by the CLI parser, so invoke the fixture runner directly here.
    const run = spawn(process.execPath, [join(f.repo, 'scripts/reading/run-reports.mjs'), '--work-dir', path], { env: { ...process.env, CODEX_BIN: join(f.folder, 'fake-codex.mjs') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = ''; run.stderr.on('data', data => error += data); const code = await new Promise(resolve => run.on('close', resolve));
    assert.equal(code, 1); assert.match(error, /outside the repository/); assert.equal(await exists(inside), false);
  }
  const invalid = f.run(['--limit', '1.5']); assert.equal((await invalid.done).code, 1); assert.match(invalid.error, /positive integer/); assert.equal(await exists(f.lock), false);
});
