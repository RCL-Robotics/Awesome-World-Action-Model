// Optional coordinator-owned original-PDF detail delivery. Never read a writer request.
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isDeepStrictEqual } from 'node:util';

const execute = promisify(execFile);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const ownPlans = new WeakMap();
export const SOURCE_DETAIL_CONTRACT = 'wam-original-source-detail-v1';
export const SOURCE_DETAIL_INSTRUCTIONS = 'SUPPORTING SOURCE DETAILS: Each supporting-source-detail is an additional unaltered region from the same pinned PDF, not a published visual and not a replacement source page. Inspect every detail and cross-check its identity, page, region and neighboring equation/table structure against its retained full page. The relevant evidence must be readable in the supplied full-page/detail pair; evaluate the full page for all other used regions and the detail for every value or symbol assigned to it. Do not infer an obscured sign/value from prose, accept an unverified detail, or waive an unreadable selected final crop. A detail may provide a higher-resolution view of a region; it does not authorize dropping any full page, figure or failed check. Copy each declared reviewRole into that image receipt. If any required evidence remains unreadable or unsupported, mark the image and bundle false.';
const check = (value, message) => { if (!value) throw new Error(message); };
function keys(value, expected, name) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)), `Invalid ${name} fields`);
}
export function sourceDetailImageId(detail) { return `detail-page-${detail.page}-${detail.id}`; }
export function validateSourceDetailSpec(spec) {
  keys(spec, ['schemaVersion', 'paperId', 'sourceSha256', 'details'], 'source-detail plan');
  check(spec.schemaVersion === 1 && typeof spec.paperId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(spec.paperId) && hash(spec.sourceSha256), 'Invalid source-detail identity');
  check(Array.isArray(spec.details) && spec.details.length >= 1 && spec.details.length <= 4, 'A source-detail plan requires 1–4 details');
  const ids = new Set();
  for (const d of spec.details) {
    keys(d, ['id', 'page', 'bounds', 'dpi', 'description'], 'source detail');
    check(typeof d.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(d.id) && !ids.has(d.id), 'Invalid or duplicate source-detail ID'); ids.add(d.id);
    check(Number.isInteger(d.page) && d.page > 0 && d.page <= 10000 && Number.isInteger(d.dpi) && d.dpi >= 180 && d.dpi <= 600, 'Invalid source-detail page or DPI');
    check(Array.isArray(d.bounds) && d.bounds.length === 4 && d.bounds.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1) && d.bounds[0] < d.bounds[2] && d.bounds[1] < d.bounds[3], 'Invalid source-detail bounds');
    check(typeof d.description === 'string' && d.description.trim() === d.description && d.description.length > 0 && d.description.length <= 1500, 'Invalid source-detail description');
  }
  return spec;
}
async function regularFile(root, path, limit) {
  const abs = resolve(path), base = await realpath(root), part = relative(base, abs);
  check(part && !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`), 'Source-detail path escapes private root');
  let cursor = base;
  for (const component of part.split(sep)) { cursor = join(cursor, component); check(!(await lstat(cursor)).isSymbolicLink(), 'Source-detail symlinks are forbidden'); }
  const st = await lstat(abs);
  check(st.isFile() && st.nlink === 1 && st.size <= limit, 'Source-detail input must be a bounded regular file without hard links');
  check(await realpath(abs) === abs, 'Source-detail path is not canonical');
  return abs;
}
export async function loadSourceDetailPlan({ path, sha256, workDir, requested }) {
  if (path === undefined && sha256 === undefined) return null;
  check(typeof path === 'string' && hash(sha256), 'Both source-detail path and SHA256 are required');
  const root = await realpath(workDir), file = await regularFile(root, resolve(path), 50000);
  const rel = relative(root, file);
  check(rel !== 'illustrated-runs' && !rel.startsWith(`illustrated-runs${sep}`), 'Source-detail plans must be outside writer/review run directories');
  const bytes = await readFile(file); check(sha(bytes) === sha256, 'Source-detail plan hash mismatch');
  const spec = validateSourceDetailSpec(JSON.parse(bytes.toString('utf8')));
  check(Array.isArray(requested) && requested.length === 1 && requested[0] === spec.paperId, 'Source-detail delivery requires exactly the explicit matching --ids paper');
  const token = Object.freeze({}); ownPlans.set(token, { file, root, sha256, json: bytes.toString('utf8') });
  return token;
}
export async function verifySourceDetailPlan(token, manifest) {
  if (token === null || token === undefined) return;
  const loaded = ownPlans.get(token); check(loaded, 'Source-detail plan must be coordinator-loaded');
  check(sha(await readFile(await regularFile(loaded.root, loaded.file, 50000))) === loaded.sha256, 'Source-detail plan changed');
  const spec = validateSourceDetailSpec(JSON.parse(loaded.json));
  check(manifest.kind === 'pdf' && manifest.paperId === spec.paperId && manifest.sha256 === spec.sourceSha256 && Number.isInteger(manifest.pageCount) && spec.details.every(d => d.page <= manifest.pageCount), 'Source-detail plan does not match the PDF manifest');
}
function attachmentContract(planJson, planSha256) {
  return { version: SOURCE_DETAIL_CONTRACT, planSha256, planJson };
}
function parseContract(contract, paperId, sourceSha256) {
  keys(contract, ['version', 'planSha256', 'planJson'], 'source-detail context');
  check(contract.version === SOURCE_DETAIL_CONTRACT && hash(contract.planSha256) && typeof contract.planJson === 'string' && Buffer.byteLength(contract.planJson) <= 50000 && sha(Buffer.from(contract.planJson)) === contract.planSha256, 'Source-detail context plan fingerprint mismatch');
  const spec = validateSourceDetailSpec(JSON.parse(contract.planJson));
  check(spec.paperId === paperId && spec.sourceSha256 === sourceSha256, 'Source-detail context identity mismatch');
  return spec;
}
export function sourceDetailRole(image) {
  const role = { 'source-page': 'supporting-source-page', 'source-detail': 'supporting-source-detail', crop: 'selected-final-crop', 'source-html-section': 'supporting-html-section', 'html-original-figure': 'selected-original-html-figure' }[image.kind];
  check(role, 'Unknown independent image role'); return role;
}
export function validateSourceDetailContext(context) {
  const detailImages = context.images.filter(image => image.kind === 'source-detail');
  if (!context.sourceDetails) { check(detailImages.length === 0, 'Source detail lacks coordinator contract'); return []; }
  check((context.sourceKind === undefined || context.sourceKind === 'pdf') && !context.htmlRendering && context.policy?.version !== 'wam-original-html-evidence-v1' && context.images.every(image => !['source-html-section', 'html-original-figure'].includes(image.kind)), 'Source details require a PDF-only review context');
  const spec = parseContract(context.sourceDetails, context.paperId, context.sourceSha256);
  check(detailImages.length === spec.details.length, 'Source-detail image inventory mismatch');
  const allIds = new Set();
  for (const image of context.images) { check(!allIds.has(image.imageId), 'Duplicate independent image ID'); allIds.add(image.imageId); }
  for (const detail of spec.details) {
    const image = detailImages.find(image => image.imageId === sourceDetailImageId(detail));
    const page = context.images.find(image => image.kind === 'source-page' && image.imageId === `page-${detail.page}` && image.page === detail.page);
    check(page && image && image.page === detail.page && image.reviewRole === 'supporting-source-detail' && hash(image.sha256), 'Source detail lacks exact image identity or retained source page');
    const d = image.description;
    keys(d, ['sourceSha256', 'detail', 'renderSha256', 'renderDimensions', 'pixelBounds', 'dimensions'], 'rendered source detail');
    check(d.sourceSha256 === spec.sourceSha256 && isDeepStrictEqual(d.detail, detail) && hash(d.renderSha256), 'Source-detail description disagrees with pinned plan');
    check(Array.isArray(d.renderDimensions) && d.renderDimensions.length === 2 && d.renderDimensions.every(n => Number.isInteger(n) && n > 0 && n <= 30000) && d.renderDimensions[0] * d.renderDimensions[1] <= 40000000, 'Invalid parent render dimensions');
    check(Array.isArray(d.pixelBounds) && d.pixelBounds.length === 4 && d.pixelBounds.every(Number.isInteger), 'Invalid source-detail pixel bounds');
    const expected = detail.bounds.map((n, i) => pythonRound(n * d.renderDimensions[i % 2]));
    check(isDeepStrictEqual(expected, d.pixelBounds) && isDeepStrictEqual(d.dimensions, [expected[2] - expected[0], expected[3] - expected[1]]) && d.dimensions.every(n => n >= 32), 'Source-detail dimensions do not follow declared bounds');
  }
  return detailImages;
}
// Match Pillow helper's Python round (nearest-even), including exact half pixels.
function pythonRound(n) { const f = Math.floor(n); return n - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(n); }
export async function appendSourceDetails(packet, token) {
  if (token === null || token === undefined) return packet;
  const loaded = ownPlans.get(token); check(loaded, 'Source-detail plan must be coordinator-loaded, not writer-supplied');
  const spec = validateSourceDetailSpec(JSON.parse(loaded.json));
  check(sha(await readFile(await regularFile(loaded.root, loaded.file, 50000))) === loaded.sha256, 'Source-detail plan changed after loading');
  const { context, attempt, images } = packet;
  check(context.paper.id === spec.paperId && context.manifest.kind === 'pdf' && context.manifest.sha256 === spec.sourceSha256 && context.config.manifest.sha256 === spec.sourceSha256, 'Source-detail source or paper mismatch');
  check(!packet.sourceDetails && images.every(i => i.kind !== 'source-detail'), 'Source details already supplied');
  for (const d of spec.details) {
    check(d.page <= context.manifest.pageCount && images.some(i => i.kind === 'source-page' && i.page === d.page && i.imageId === `page-${d.page}`), 'Source-detail page must already be retained in the normal full-page inventory');
    check(!images.some(i => i.imageId === sourceDetailImageId(d)), 'Source-detail ID collision');
  }
  const source = await regularFile(loaded.root, context.manifest.sourcePath, 400000000);
  check(sha(await readFile(source)) === spec.sourceSha256, 'Primary PDF changed before source-detail render');
  const parent = await realpath(dirname(attempt));
  const rel = relative(loaded.root, parent); check(rel && !isAbsolute(rel) && !rel.startsWith('..'), 'Source-detail render root must remain private');
  const directory = await mkdtemp(join(parent, 'source-details-'));
  const fonts = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/fonts');
  const fontConfig = join(directory, 'fonts.conf');
  const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  await writeFile(fontConfig, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xml(fonts)}</dir><cachedir>${xml(directory)}/fontcache</cachedir></fontconfig>`);
  const pdf = join(directory, 'source.pdf'); await copyFile(source, pdf);
  check(sha(await readFile(pdf)) === spec.sourceSha256, 'Source-detail PDF copy mismatch');
  const extra = [];
  for (const d of spec.details) {
    const target = join(directory, sourceDetailImageId(d));
    const helper = fileURLToPath(new URL('../reading/render-source-detail.py', import.meta.url));
    const { stdout } = await execute(context.config.python, [helper, '--pdf', pdf, '--source-sha256', spec.sourceSha256, '--pdftoppm', context.config.pdftoppm, '--page', String(d.page), '--dpi', String(d.dpi), '--bounds', ...d.bounds.map(String), '--output-prefix', target], { timeout: 60000, maxBuffer: 2000000, env: { ...process.env, FONTCONFIG_FILE: fontConfig } });
    const result = JSON.parse(stdout), path = `${target}.png`;
    check(result.sourceSha256 === spec.sourceSha256 && result.page === d.page && result.dpi === d.dpi && isDeepStrictEqual(result.bounds, d.bounds), 'Source-detail renderer returned a different specification');
    const bytes = await readFile(await regularFile(directory, path, 100000000));
    check(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && sha(bytes) === result.sha256 && isDeepStrictEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], result.dimensions), 'Source-detail PNG fingerprint or dimensions mismatch');
    check(sha(await readFile(await regularFile(directory, `${target}-page.png`, 150000000))) === result.renderSha256, 'Source-detail parent render changed');
    extra.push({ imageId: sourceDetailImageId(d), kind: 'source-detail', page: d.page, path, sha256: result.sha256, reviewRole: 'supporting-source-detail', description: { sourceSha256: spec.sourceSha256, detail: d, renderSha256: result.renderSha256, renderDimensions: result.renderDimensions, pixelBounds: result.pixelBounds, dimensions: result.dimensions } });
  }
  check(sha(await readFile(pdf)) === spec.sourceSha256 && sha(await readFile(source)) === spec.sourceSha256 && sha(await readFile(await regularFile(loaded.root, loaded.file, 50000))) === loaded.sha256, 'Source/detail plan changed during rendering');
  const sourceDetails = attachmentContract(loaded.json, loaded.sha256);
  const result = { ...packet, images: [...images, ...extra], sourceDetails };
  validateSourceDetailContext({ paperId: spec.paperId, sourceSha256: spec.sourceSha256, images: result.images, sourceDetails });
  return result;
}
