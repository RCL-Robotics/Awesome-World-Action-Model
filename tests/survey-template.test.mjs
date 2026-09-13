import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, access, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createSurvey } from '../skills/survey-repo-builder/scripts/create-survey.mjs';
import { renderDocuments } from '../skills/survey-repo-builder/assets/template/scripts/generate.mjs';
const config = JSON.parse(await readFile(new URL('../examples/efficient-learning/survey.config.json', import.meta.url), 'utf8'));
const papers = JSON.parse(await readFile(new URL('../examples/efficient-learning/papers.json', import.meta.url), 'utf8'));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'generic-survey-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = join(dir, 'config.json'), papersPath = join(dir, 'papers.json');
  await writeFile(configPath, JSON.stringify(config)); await writeFile(papersPath, JSON.stringify(papers));
  return { dir, configPath, papersPath, out: join(dir, 'project') };
}
test('repository-only generation is standalone, dependency-free and leaves input metadata intact', async t => {
  const f = await fixture(t);
  await createSurvey({ ...f, mode: 'repo' });
  const pkg = JSON.parse(await readFile(join(f.out, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  await assert.rejects(access(join(f.out, 'src')));
  await assert.rejects(access(join(f.out, '.github/workflows/pages.yml')));
  assert.deepEqual(JSON.parse(await readFile(join(f.out, 'data/papers.json'), 'utf8')), papers);
  assert.deepEqual(JSON.parse(await readFile(f.papersPath, 'utf8')), papers);
  const readme = await readFile(join(f.out, 'README.md'), 'utf8');
  assert.match(readme, /Efficient Learning Survey/); assert.match(readme, /docs\/PAPERS.md#category-compression/);
  execFileSync(process.execPath, ['scripts/catalog.mjs', 'validate'], { cwd: f.out, stdio: 'pipe' });
  execFileSync(process.execPath, ['--test', 'tests/catalog.test.mjs'], { cwd: f.out, stdio: 'pipe' });
});
test('website modes include a pinned runnable project while site-only mode omits the Markdown catalog', async t => {
  const f = await fixture(t);
  await createSurvey({ ...f, mode: 'site' });
  await access(join(f.out, 'src/pages/papers/[id].astro'));
  await access(join(f.out, '.github/workflows/pages.yml'));
  await assert.rejects(access(join(f.out, 'docs/PAPERS.md')));
  const pkg = JSON.parse(await readFile(join(f.out, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(f.out, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages[''].name, pkg.name); assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
});
test('empty catalogs and arbitrary project categories work without copied subject data', async t => {
  const f = await fixture(t);
  await writeFile(f.configPath, JSON.stringify({ ...config, title: '图学习综述', language: 'zh', categories: [{ id: 'graph-methods', label: '图方法', description: '自定义分类', sort: 'newest' }], sections: [], exampleData: false }));
  await createSurvey({ ...f, papersPath: undefined, mode: 'both' });
  assert.deepEqual(JSON.parse(await readFile(join(f.out, 'data/papers.json'), 'utf8')), []);
  assert.match(await readFile(join(f.out, 'README.md'), 'utf8'), /图学习综述/);
});
test('existing destinations and invalid data are never overwritten', async t => {
  const f = await fixture(t); await mkdir(f.out); await writeFile(join(f.out, 'keep'), 'original');
  await assert.rejects(createSurvey(f), /already exists/);
  assert.equal(await readFile(join(f.out, 'keep'), 'utf8'), 'original');
  await writeFile(f.papersPath, JSON.stringify([{ ...papers[0], categories: ['not-configured'] }]));
  await assert.rejects(createSurvey({ ...f, out: join(f.dir, 'invalid') }), /category/);
  await assert.rejects(access(join(f.dir, 'invalid')));
});
test('figure inputs must exist and copied assets cannot point into private external directories', async t => {
  const f = await fixture(t), assets = join(f.dir, 'assets'); await mkdir(assets);
  const figure = { src: '/assets/figure.svg', alt: 'A supplied sample figure', caption: 'Synthetic fixture.' };
  await writeFile(f.configPath, JSON.stringify({ ...config, figures: [figure] }));
  await assert.rejects(createSurvey(f), /Supply figure/);
  await writeFile(join(assets, 'figure.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await createSurvey({ ...f, assets, mode: 'repo' });
  assert.match(await readFile(join(f.out, 'README.md'), 'utf8'), /public\/assets\/figure.svg/);
  await symlink(join(f.dir, 'config.json'), join(assets, 'external'));
  await assert.rejects(createSurvey({ ...f, out: join(f.dir, 'linked'), assets }), /symbolic links/);
});
test('import CLI previews without writing and applies idempotently', async t => {
  const f = await fixture(t); await createSurvey({ ...f, mode: 'repo' });
  const input = join(f.dir, 'new.json'); await writeFile(input, JSON.stringify([{ title: 'A supplied paper', url: 'https://example.org/new-paper' }]));
  const run = args => execFileSync(process.execPath, ['scripts/catalog.mjs', 'import', '--input', input, ...args], { cwd: f.out, encoding: 'utf8', stdio: 'pipe' });
  const data = join(f.out, 'data/papers.json'), before = await readFile(data, 'utf8');
  assert.equal(JSON.parse(run([])).added.length, 1); assert.equal(await readFile(data, 'utf8'), before);
  run(['--apply']); const once = await readFile(data, 'utf8'); run(['--apply']); assert.equal(await readFile(data, 'utf8'), once);
});
test('configuration text is escaped in Markdown and unknown public fields are rejected', async t => {
  const f = await fixture(t);
  const documents = renderDocuments({ ...config, title: '<script>alert(1)</script>' }, papers);
  assert.doesNotMatch(documents.readme, /<script>/);
  await writeFile(f.configPath, JSON.stringify({ ...config, privateToken: 'fixture-not-a-real-token' }));
  await assert.rejects(createSurvey(f), /unsupported fields/);
});
