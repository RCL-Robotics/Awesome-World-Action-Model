#!/usr/bin/env node
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig, validatePapers } from '../assets/template/lib/catalog.mjs';
import { generate } from '../assets/template/scripts/generate.mjs';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const template = join(skillRoot, 'assets/template');
const exists = async path => { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
async function rejectSymlinks(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error('Asset input must contain regular files and directories, not symbolic links.');
  if (stat.isDirectory()) for (const name of await readdir(path)) await rejectSymlinks(join(path, name));
  else if (!stat.isFile()) throw new Error('Unsupported asset file type.');
}
export async function createSurvey({ configPath, papersPath, out, mode, assets }) {
  if (!configPath || !out) throw new Error('Provide --config FILE and --out NEW_DIRECTORY.');
  const config = validateConfig({ ...JSON.parse(await readFile(resolve(configPath), 'utf8')), ...(mode ? { mode } : {}) });
  const papers = validatePapers(papersPath ? JSON.parse(await readFile(resolve(papersPath), 'utf8')) : [], config);
  const output = resolve(out);
  if (await exists(output)) throw new Error('Destination already exists; choose a new directory.');
  await mkdir(dirname(output), { recursive: true });
  const parent = await realpath(dirname(output)), source = await realpath(skillRoot);
  if (parent === source || parent.startsWith(source + sep)) throw new Error('Choose a destination outside the skill source.');
  if (assets) await rejectSymlinks(resolve(assets));
  let stage = await mkdtemp(join(parent, '.survey-create-'));
  try {
    await cp(template, stage, { recursive: true, filter: path => !['node_modules', '.astro', 'dist'].includes(path.split(sep).at(-1)) });
    if (assets) await cp(resolve(assets), join(stage, 'public/assets'), { recursive: true });
    for (const figure of config.figures) if (!(await exists(join(stage, 'public', figure.src.slice(1))))) throw new Error(`Supply figure ${figure.src} through --assets DIRECTORY.`);
    await writeFile(join(stage, 'survey.config.json'), JSON.stringify(config, null, 2) + '\n');
    await writeFile(join(stage, 'data/papers.json'), JSON.stringify(papers, null, 2) + '\n');
    const pkg = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
    pkg.name = (config.repository?.name || config.title).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'research-survey';
    let lock;
    if (config.mode === 'repo') {
      pkg.scripts = { 'validate:data': 'node scripts/catalog.mjs validate', generate: 'node scripts/generate.mjs', test: 'node --test tests/*.test.mjs', check: 'npm run validate:data', build: 'npm run validate:data && npm run generate' };
      delete pkg.dependencies; delete pkg.devDependencies;
      lock = { name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true, packages: { '': { name: pkg.name, version: pkg.version, engines: pkg.engines } } };
      for (const path of ['src', 'astro.config.mjs', 'tsconfig.json', '.github/workflows/pages.yml', 'scripts/check-deploy.mjs']) await rm(join(stage, path), { recursive: true, force: true });
    } else {
      lock = JSON.parse(await readFile(join(stage, 'package-lock.json'), 'utf8'));
      lock.name = pkg.name; lock.packages[''].name = pkg.name;
    }
    await writeFile(join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    await writeFile(join(stage, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
    await generate(stage);
    if (await exists(output)) throw new Error('Destination was created during generation; nothing was overwritten.');
    await rename(stage, output); stage = null;
    return { directory: output, mode: config.mode, papers: papers.length, categories: config.categories.length };
  } finally { if (stage) await rm(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('create-survey.mjs --config FILE [--papers FILE] --out NEW_DIRECTORY [--mode repo|site|both] [--assets DIRECTORY]');
  else {
    try {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (!['--config', '--papers', '--out', '--mode', '--assets'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown or incomplete argument: ${args[i]}`);
        const key = args[i].slice(2); if (Object.hasOwn(options, key)) throw new Error(`Repeated argument: ${args[i]}`); options[key] = args[++i];
      }
      console.log(JSON.stringify(await createSurvey({ configPath: options.config, papersPath: options.papers, out: options.out, mode: options.mode, assets: options.assets }), null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
