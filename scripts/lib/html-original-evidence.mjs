import {selectedPolicyVersion,selectedPaperId,selectedCodeSha,selectedDisclosure,selectedLocator,selectedSourceCatalog,selectedAssetDelivery,loadSelectedEvidence,snapshotSelectedEvidence,verifySelectedInputPin,renderSelectedEvidence,preparedSelectedEvidence} from './selected-html-source.mjs';
import {openScenePolicyVersion,openSceneCodeSha256,openSceneLocator,openSceneDisclosure,loadOpenSceneEvidence,snapshotOpenSceneEvidence,renderOpenSceneEvidence,verifyOpenSceneInputPin,preparedOpenSceneEvidence} from './openscene-original-evidence.mjs';
import { readFile, writeFile, appendFile, mkdir, lstat, realpath, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, isAbsolute, sep, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { mediaPolicyVersion, mediaCodeSha256, mediaLocator, mediaDisclosure, loadMediaEvidence, renderMediaEvidence } from './html-original-media.mjs';
export function htmlSourceDisclosure(f,d) { return d.policyVersion===selectedPolicyVersion ? selectedDisclosure : d.policyVersion===openScenePolicyVersion ? openSceneDisclosure(f,d) : d.policyVersion===mediaPolicyVersion ? mediaDisclosure(f,d) : d.wrapperDisclosure; }
export const htmlPolicyVersion = 'wam-original-html-evidence-v1';
export function originalHtmlLayoutCss(dependencies) {
  const names = ['AuthorSaans', 'AuthorSerrif', 'AuthorMono', 'AuthorMonoWoff'];
  if (!Array.isArray(dependencies) || dependencies.length > 4) throw new Error('Unsupported original HTML font inventory');
  return dependencies.map((dep, i) => `@font-face{font-family:${names[i]};src:url(${JSON.stringify(dep.url)})}`).join('\n') + '\n' + "body{margin:0;padding:56px 80px;background:#fff;font-family:AuthorSaans,sans-serif;color:#222}section{width:100%}p{line-height:1.45}svg[role=\"img\"]{display:block;width:100%;height:auto;overflow:visible;margin:18px 0}div[class~=\"flex\"],span[class~=\"flex\"]{display:flex;gap:12px;flex-wrap:wrap}.flex-col{flex-direction:column}.w-full{width:100%}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}.font-mono{font-family:AuthorMono,monospace}div[class~=\"w-[253px]\"]{width:253px;display:block;flex-shrink:0}table{border-collapse:collapse;width:100%;font-size:18px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}svg:not([role=\"img\"]){max-width:24px;max-height:24px}button{display:none}\n.katex-html{display:none} .katex-mathml{display:block} .article-body{line-height:1.6}";
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const htmlRendererCodeSha256 = digest(await readFile(new URL(import.meta.url)));
const hashOK = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const idOK = x => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{0,100}$/.test(x);
const fail = m => { throw new Error(`Original HTML evidence: ${m}`); };
export async function boundedFile(root, name, limit = 30_000_000) {
  if (typeof name !== 'string' || isAbsolute(name) || name.split(/[\\/]/).includes('..')) fail('unsafe path');
  const path = resolve(root, name), part = relative(resolve(root), path);
  if (!part || part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) fail('unsafe path');
  let cursor = resolve(root);
  if ((await lstat(cursor)).isSymbolicLink()) fail('symlink root');
  for (const piece of part.split(sep)) { cursor = join(cursor, piece); if ((await lstat(cursor)).isSymbolicLink()) fail('symlink artifact'); }
  const stat = await lstat(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > limit) fail('unbounded or linked artifact');
  if (await realpath(path) !== path) fail('noncanonical artifact');
  return path;
}
export async function pinnedBytes(root, item, limit) {
  if (!item || !hashOK(item.sha256)) fail('missing file pin');
  const bytes = await readFile(await boundedFile(root, item.path, limit));
  if (digest(bytes) !== item.sha256) fail(`file fingerprint changed: ${item.path}`);
  return bytes;
}
const text = x => typeof x === 'string' && x.trim().length > 0;
export function htmlLocator(fragment, descriptorHash, descriptor) {
  if(descriptor.policyVersion===selectedPolicyVersion)return selectedLocator(fragment,descriptorHash,descriptor,htmlRendererCodeSha256);
  if(descriptor.policyVersion===openScenePolicyVersion)return openSceneLocator(fragment,descriptorHash,descriptor,htmlRendererCodeSha256);
  if (descriptor.policyVersion===mediaPolicyVersion) return mediaLocator(fragment,descriptorHash,descriptor,htmlRendererCodeSha256);
  return { kind: 'html-original', rendererCodeSha256: htmlRendererCodeSha256, fragmentId: fragment.id, anchor: fragment.anchor, parts: fragment.parts, descriptorSha256: descriptorHash, wrapperSha256: descriptor.wrapper.sha256, rendererSha256: descriptor.runtime.chromeSha256 };
}
export async function loadHtmlEvidence(root, config) {
  const pin = config.htmlVisuals;
  if (pin?.rendererCodeSha256 && pin.rendererCodeSha256 !== htmlRendererCodeSha256) fail('trusted HTML renderer code changed');
  if (config.manifest.kind !== 'html' || !pin) fail('source-kind mismatch or no pinned HTML descriptor');
  const bytes = await pinnedBytes(root, pin, 5_000_000), d = JSON.parse(bytes);
  if(config.manifest.paperId===selectedPaperId&&d.policyVersion!==selectedPolicyVersion)fail('Selected book source requires its dedicated source policy; no legacy fallback');
  if(d.policyVersion===selectedPolicyVersion)return loadSelectedEvidence(root,config,htmlRendererCodeSha256);
  if(d.policyVersion===openScenePolicyVersion)return loadOpenSceneEvidence(root,config,htmlRendererCodeSha256);
  if (d.policyVersion===mediaPolicyVersion) return loadMediaEvidence(root,config,htmlRendererCodeSha256);
  if (d.schemaVersion !== 1 || d.policyVersion !== htmlPolicyVersion || d.paperId !== config.manifest.paperId || d.sourceSha256 !== config.manifest.sha256 || d.textSha256 !== config.manifest.textSha256 || d.canonicalUrl !== config.manifest.canonicalUrl) fail('descriptor identity mismatch');
  if (!d.runtime || !hashOK(d.runtime.chromeSha256) || !text(d.runtime.chromePath) || !text(d.runtime.browserVersion) || !text(d.runtime.playwrightPath) || !hashOK(d.runtime.playwrightEntrySha256) || !text(d.runtime.nodePath)) fail('unpinned renderer runtime');
  if (digest(await readFile(d.runtime.chromePath)) !== d.runtime.chromeSha256 || digest(await readFile(d.runtime.playwrightPath)) !== d.runtime.playwrightEntrySha256) fail('renderer runtime fingerprint changed');
  if (!d.viewport || !Number.isInteger(d.viewport.width) || d.viewport.width < 600 || d.viewport.width > 2400 || !Number.isInteger(d.viewport.height) || d.viewport.height < 400 || d.viewport.height > 2400 || ![1,2].includes(d.deviceScaleFactor)) fail('invalid renderer bounds');
  const raw = await pinnedBytes(root, { path: config.sourceFile, sha256: d.sourceSha256 }, 100_000_000);
  await pinnedBytes(root, { path: 'source.txt', sha256: d.textSha256 }, 100_000_000);
  const chars = Array.from(raw.toString('utf8'));
  const css = (await pinnedBytes(root, d.wrapper, 100_000)).toString('utf8');
  if (!text(d.wrapperDisclosure) || /<\/style|@import/i.test(css)) fail('unsafe or undisclosed wrapper');
  if (d.wrapperProfile !== 'original-html-layout-v1' || css !== originalHtmlLayoutCss(d.dependencies)) fail('unapproved layout wrapper; source graph geometry/text may not be restyled');
  if (!Array.isArray(d.dependencies) || d.dependencies.length > 10) fail('invalid dependency inventory');
  const dependencies = new Map();
  for (const dep of d.dependencies) {
    const url = new URL(dep.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || dependencies.has(dep.url) || !['font/ttf','font/woff','font/woff2'].includes(dep.mimeType)) fail('invalid font dependency');
    dependencies.set(dep.url, { ...dep, bytes: await pinnedBytes(root, dep, 8_000_000) });
  }
  for (const m of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) if (!dependencies.has(m[1])) fail('wrapper references an unpinned dependency');
  if (!Array.isArray(d.fragments) || !d.fragments.length || d.fragments.length > 100) fail('invalid fragment inventory');
  const fragments = new Map();
  for (const f of d.fragments) {
    if (!idOK(f.id) || fragments.has(f.id) || !['supporting-section','original-figure'].includes(f.role) || !text(f.sourceLabel) || !Array.isArray(f.parts) || !f.parts.length || f.parts.length > 100) fail('invalid fragment record');
    if (f.anchor !== null && !(typeof f.anchor === 'string' && /^[a-z0-9][a-z0-9-]{0,220}$/.test(f.anchor))) fail('invalid original anchor');
    if (!Array.isArray(f.requiredText) || !f.requiredText.length || f.requiredText.some(x => !text(x)) || !hashOK(f.visibleTextSha256)) fail('missing complete text or labels pin');
    let previous = -1;
    const parts = f.parts.map(part => {
      if (!Number.isInteger(part.startCharacter) || !Number.isInteger(part.endCharacter) || part.startCharacter < 0 || part.endCharacter <= part.startCharacter || part.endCharacter > chars.length || part.startCharacter < previous || !hashOK(part.sha256)) fail('invalid source character range');
      previous = part.endCharacter;
      const value = chars.slice(part.startCharacter, part.endCharacter).join('');
      if (digest(value) !== part.sha256) fail('original source fragment fingerprint changed');
      return value;
    });
    const markup = parts.join('\n');
    if (/<(?:script|iframe|object|embed|video|audio|source|img|image|foreignObject|link|base)\b|\son[a-z]+\s*=|javascript\s*:|\b(?:src|srcset)\s*=/i.test(markup)) fail('active or external source content is unsupported');
    // Source SVG gradients/arrows may reference same-document IDs; never fetch external hrefs.
    for (const tag of markup.matchAll(/<([a-z][a-z0-9:-]*)\b[^>]*>/gi)) for (const m of tag[0].matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']*)["']/gi)) {
      const staticHyperlink = tag[1].toLowerCase() === 'a' && /^(?:https?:\/\/|\/|#)/.test(m[1]);
      if (!m[1].startsWith('#') && !staticHyperlink) fail('external SVG resource or unsafe hyperlink');
    }
    for (const m of markup.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) if (!m[1].startsWith('#')) fail('external inline CSS resource');
    if (f.anchor && !new RegExp(`\\bid=["']${f.anchor}["']`).test(markup)) fail('anchor is absent from exact source fragment');
    fragments.set(f.id, { ...f, markup });
  }
  if (!fragments.has(d.identitySectionId) || fragments.get(d.identitySectionId).role !== 'supporting-section') fail('missing identity supporting section');
  return { descriptor: d, descriptorSha256: digest(bytes), css, dependencies, fragments };
}

export async function verifyHtmlInputPin({ attempt, config, bundlePath, expectedSha256 }) {
  if (!bundlePath || !hashOK(expectedSha256)) fail('HTML publication recovery requires its explicit original descriptor and SHA256');
  const bytes = await readFile(await boundedFile(dirname(resolve(bundlePath)), bundlePath.split(/[\\/]/).at(-1), 5_000_000));
  if (digest(bytes) !== expectedSha256 || digest(bytes) !== config.htmlVisuals?.inputSha256) fail('HTML input descriptor changed');
  const input = JSON.parse(bytes);
  if(input.policyVersion===selectedPolicyVersion)return verifySelectedInputPin({attempt,config,bundlePath,expectedSha256,rendererCodeSha256:htmlRendererCodeSha256});
  if(input.policyVersion===openScenePolicyVersion)return verifyOpenSceneInputPin({attempt,config,bundlePath,expectedSha256,rendererCodeSha256:htmlRendererCodeSha256});
  const rewrite = item => ({ ...item, path: `html-source/${item.sha256}.bin` });
  const expected = { ...input, wrapper: rewrite(input.wrapper), dependencies: input.dependencies.map(rewrite), ...(input.policyVersion===mediaPolicyVersion ? {media:{...input.media,decoder:rewrite(input.media.decoder),resources:input.media.resources.map(rewrite)}} : {}) };
  if (config.htmlVisuals.path !== 'html-source/descriptor.json' || config.htmlVisuals.sha256 !== digest(`${JSON.stringify(expected, null, 2)}\n`)) fail('HTML snapshot descriptor differs from pinned input');
  return loadHtmlEvidence(attempt, config);
}

export async function snapshotHtmlEvidence({ attempt, config, bundlePath, expectedSha256, helperPath, shouldStop }) {
  const base = dirname(resolve(bundlePath)), bytes = await readFile(await boundedFile(base, bundlePath.split(/[\\/]/).at(-1), 5_000_000));
  if (!hashOK(expectedSha256) || digest(bytes) !== expectedSha256) fail('Input HTML descriptor does not match explicit SHA256');
  const d = JSON.parse(bytes);
  if(d.policyVersion===selectedPolicyVersion)return snapshotSelectedEvidence({attempt,config,bundlePath,expectedSha256,helperPath,shouldStop,rendererCodeSha256:htmlRendererCodeSha256});
  if(d.policyVersion===openScenePolicyVersion)return snapshotOpenSceneEvidence({attempt,config,bundlePath,expectedSha256,helperPath,shouldStop,rendererCodeSha256:htmlRendererCodeSha256});
  const directory = join(attempt, 'html-source'); await mkdir(directory);
  const rewrite = async item => {
    const data = await pinnedBytes(base, item, 12_000_000);
    const name = `html-source/${item.sha256}.bin`;
    try { await writeFile(join(attempt, name), data, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST' || digest(await readFile(join(attempt, name))) !== item.sha256) throw e; }
    return { ...item, path: name };
  };
  const snapshot = { ...d, wrapper: await rewrite(d.wrapper), dependencies: await Promise.all(d.dependencies.map(rewrite)), ...(d.policyVersion===mediaPolicyVersion ? {media:{...d.media,decoder:await rewrite(d.media.decoder),resources:await Promise.all(d.media.resources.map(rewrite))}} : {}) };
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(join(attempt, 'html-source/descriptor.json'), serialized, { flag: 'wx' });
  await copyFile(helperPath, join(attempt, 'source-html.mjs'));
  await copyFile(new URL('./html-original-media.mjs',import.meta.url),join(attempt,'html-original-media.mjs'));
  for(const name of ['openscene-original-evidence.mjs','openscene-process.mjs','openscene-render.mjs','selected-html-source.mjs','selected-html-render.mjs'])await copyFile(new URL('./'+name,import.meta.url),join(attempt,name));
  const next = { ...config, htmlVisuals: { ...(d.policyVersion===mediaPolicyVersion ? {mediaCodeSha256} : {}), rendererCodeSha256: htmlRendererCodeSha256, path: 'html-source/descriptor.json', sha256: digest(serialized), inputSha256: digest(bytes) } };
  const pack = await loadHtmlEvidence(attempt, next);
  // The coordinator renders before starting the sandboxed writer. The writer
  // receives these images through --show; it never needs to launch a browser.
  const prepared = await renderHtmlEvidence({ root: attempt, config: next, ids: [...pack.fragments.keys()], outputDirectory: join(attempt, 'html-prepared'), shouldStop });
  const inventory = `${JSON.stringify(prepared.records.map(item => ({ ...item, path: relative(attempt, item.path) })), null, 2)}\n`;
  await writeFile(join(attempt, 'html-source/prepared-renders.json'), inventory, { flag: 'wx' });
  next.htmlVisuals.prepared = { path: 'html-source/prepared-renders.json', sha256: digest(inventory) };
  if (prepared.mediaEvidence) { const data=JSON.stringify(prepared.mediaEvidence,null,2)+'\n'; await writeFile(join(attempt,'html-source/prepared-media.json'),data,{flag:'wx'}); next.htmlVisuals.preparedMedia={path:'html-source/prepared-media.json',sha256:digest(data)}; }
  await preparedHtmlImages(attempt, next);
  return next;
}

export async function renderHtmlEvidence({ root, config, ids, outputDirectory, shouldStop = () => false }) {
  const deadline = Date.now() + 300_000;
  const checkActive = () => { if (shouldStop() || Date.now() > deadline) fail('render interrupted or five-minute budget exceeded'); };
  checkActive();
  const pack = await loadHtmlEvidence(root, config), d = pack.descriptor;
  if(d.policyVersion===selectedPolicyVersion)return renderSelectedEvidence({root,config,ids,outputDirectory,shouldStop,rendererCodeSha256:htmlRendererCodeSha256});
  if(d.policyVersion===openScenePolicyVersion)return renderOpenSceneEvidence({root,config,ids,outputDirectory,shouldStop,rendererCodeSha256:htmlRendererCodeSha256});
  if(d.policyVersion===mediaPolicyVersion) return renderMediaEvidence({root,config,ids,outputDirectory,shouldStop,rendererCodeSha256:htmlRendererCodeSha256});
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !pack.fragments.has(id))) fail('unknown or duplicate render fragment');
  // Output must be a fresh, caller-owned directory. No cached image can count as a fresh render.
  const output = resolve(outputDirectory), within = relative(resolve(root), output);
  if (!within || within.startsWith('..') || isAbsolute(within)) fail('render output escapes workspace');
  if ((await lstat(dirname(output))).isSymbolicLink() || await realpath(dirname(output)) !== dirname(output)) fail('symlink render output');
  await mkdir(output, { recursive: false });
  const { chromium } = await import(pathToFileURL(d.runtime.playwrightPath));
  const browser = await chromium.launch({ executablePath: d.runtime.chromePath, headless: true, args: ['--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND','--disable-gpu'] });
  const records = [];
  try {
    if (browser.version() !== d.runtime.browserVersion) fail('browser version differs from pinned recipe');
    for (const id of ids) {
      checkActive();
      // Fresh context per fragment prevents prior HTML/MathML/SVG font state
      // from changing later pixels when the verification inventory differs.
      const context = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, javaScriptEnabled: false, serviceWorkers: 'block' });
    const blocked = [];
    await context.route('**/*', async route => {
      const dep = pack.dependencies.get(route.request().url());
      if (dep) await route.fulfill({ body: dep.bytes, contentType: dep.mimeType });
      else { blocked.push(route.request().url()); await route.abort(); }
    });
    try {
      const page = await context.newPage();
      const fragment = pack.fragments.get(id);
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src https:; script-src 'none'; connect-src 'none'; img-src 'none'"><style>${pack.css}</style></head><body>${fragment.markup}</body></html>`, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      // Trusted layout code only; source JavaScript is disabled and rejected above.
      await page.evaluate(() => { for (const svg of document.querySelectorAll('svg[role=img]')) { const v = svg.viewBox.baseVal; if (v.width && v.height) svg.style.height = `${svg.getBoundingClientRect().width * v.height / v.width}px`; } });
      const visibleText = await page.locator('body').innerText();
      const normalized = visibleText.replace(/\s+/g,' ').trim();
      if (digest(normalized) !== fragment.visibleTextSha256 || fragment.requiredText.some(value => !normalized.includes(value.replace(/\s+/g,' ').trim()))) fail('missing source labels, captions, footnotes or complete text');
      const size = await page.locator('body').boundingBox();
      if (!size || size.height > 20_000 || size.width > 3000 || blocked.length) fail('unbounded render or attempted unpinned resource');
      const path = join(output, `${id}.png`); await page.screenshot({ path, fullPage: true, animations: 'disabled' });
      const png = await readFile(path);
      records.push({ id, path, sha256: digest(png), width: png.readUInt32BE(16), height: png.readUInt32BE(20), locator: htmlLocator(fragment, pack.descriptorSha256, d), role: fragment.role, sourceLabel: fragment.sourceLabel, visibleTextSha256: digest(normalized) });
    } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  checkActive();
  await loadHtmlEvidence(root, config); // Detect source/dependency/runtime drift during render.
  return { records, descriptor: d, descriptorSha256: pack.descriptorSha256 };
}

export async function preparedHtmlImages(root, config, requested) {
  const pack = await loadHtmlEvidence(root, config);
  const selectedPreparation=pack.descriptor.policyVersion===selectedPolicyVersion?await preparedSelectedEvidence(root,config,pack):null;
  const nativeEvidence=pack.descriptor.policyVersion===openScenePolicyVersion?await preparedOpenSceneEvidence(root,config,pack):null;
  const mediaEvidence=pack.descriptor.policyVersion===mediaPolicyVersion ? JSON.parse(await pinnedBytes(root,config.htmlVisuals.preparedMedia,5000000)) : null;
  if(mediaEvidence && (mediaEvidence.codeSha256!==mediaCodeSha256 || mediaEvidence.manifestSha256!==digest(JSON.stringify(pack.descriptor.media)))) fail('prepared media execution provenance differs');
  const records = JSON.parse(await pinnedBytes(root, config.htmlVisuals.prepared, 5_000_000));
  if (!Array.isArray(records) || records.length !== pack.fragments.size || new Set(records.map(r => r.id)).size !== records.length) fail('prepared original image inventory changed');
  for (const item of records) {
    const fragment = pack.fragments.get(item.id);
    if (!fragment || item.role !== fragment.role || JSON.stringify(item.locator) !== JSON.stringify(htmlLocator(fragment, pack.descriptorSha256, pack.descriptor))) fail('prepared image source locator changed');
    const bytes = await pinnedBytes(root, item);
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== item.width || bytes.readUInt32BE(20) !== item.height) fail('prepared image dimensions changed');
  }
  const ids = requested || records.map(r => r.id);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !pack.fragments.has(id))) fail('unknown or duplicate prepared image request');
  return { ...(selectedPreparation?{selectedPreparation}:{}), ...(nativeEvidence?{nativeEvidence}:{}), ...(mediaEvidence ? {mediaEvidence} : {}), records: ids.map(id => { const item = records.find(r => r.id === id); return { ...item, path: resolve(root, item.path) }; }), descriptor: pack.descriptor, descriptorSha256: pack.descriptorSha256 };
}

async function main(args) {
  const catalog=args.length===3&&args[0]==='--root'&&args[2]==='--catalog';
  const asset=args.length===4&&args[0]==='--root'&&args[2]==='--asset';
  if(catalog||asset){const root=resolve(args[1]),config=JSON.parse(await readFile(await boundedFile(root,'source-config.json'))),pack=await loadHtmlEvidence(root,config);if(pack.descriptor.policyVersion!==selectedPolicyVersion)fail('Selected source catalog/assets cannot change another source policy');const result=catalog?selectedSourceCatalog(pack):await selectedAssetDelivery(pack,args[3]);if(asset){try{await boundedFile(root,'source-audit.jsonl');}catch(e){if(e.code!=='ENOENT')throw e;}await appendFile(join(root,'source-audit.jsonl'),JSON.stringify({operation:'html-original-asset-delivery',...result})+'\n');}console.log(JSON.stringify(result));return;}
  const showing = args.length === 4 && args[2] === '--show';
  const rendering = args.length === 5 && args[2] === '--render' && args[4] === '--new-output';
  if (args[0] !== '--root' || !(showing || rendering)) fail('Usage: node source-html.mjs --root ATTEMPT --show ID,ID (writer); --render ID,ID --new-output (coordinator only)');
  const root = resolve(args[1]), config = JSON.parse(await readFile(await boundedFile(root,'source-config.json')));
  const result = showing ? await preparedHtmlImages(root, config, args[3].split(',')) : await renderHtmlEvidence({ root, config, ids: args[3].split(','), outputDirectory: join(root, `html-render-${Date.now()}-${process.pid}`) });
  const audit = join(root, 'source-audit.jsonl');
  try { await boundedFile(root, 'source-audit.jsonl'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  for (const item of result.records) await appendFile(audit, `${JSON.stringify({ operation: showing ? 'html-delivery' : 'html-render', ...item, descriptorSha256: result.descriptorSha256 })}\n`);
  console.log(JSON.stringify(result.descriptor.policyVersion===selectedPolicyVersion?{records:result.records,descriptorSha256:result.descriptorSha256,sourceScope:selectedDisclosure}:result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
