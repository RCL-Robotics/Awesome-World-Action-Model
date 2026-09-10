// Source verifier forked exactly from frozen MP4 preparation; integration code closure is externally approval-pinned.
// Exact Microsoft source profile. Historical native stills never attest continuous video.
import { readFile, lstat, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, relative, isAbsolute, sep, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const MP4_POLICY = 'wam-original-mp4-sampled-evidence-v1';
export const MP4_PAPER = 'ref-23e2ef710ce5722e25a2';
export const MP4_DESCRIPTOR_SHA = 'db669e6d383523c3fe9a37d29d53398a4f352b66697c3297ff8cc89a7a5dc327';
export const MP4_SOURCE_SHA = 'c254856561d5577230ee2fa4fa1b5118465ac16b7e5f10f4242d2e0895eefadb';
export const MP4_TEXT_SHA = '8f321529dd6aba3c6f42b725ac209e901e3388b102cc09a9c849362428cdb6de';
export const MP4_SCOPE = Object.freeze({ mode: 'four-decoded-stills-per-clip', frameCount: 40, clipCount: 10,
  fullMotionViewed: false, audioReviewed: false, latencyMeasured: false,
  benchmarkSuccessEstablished: false, modelExecutionVerified: false, continuousOperationEstablished: false });
export const MP4_GUARDRAILS = Object.freeze({
  permittedEvidence: ['visible-sampled-state', 'original-author-caption', 'platform-display'],
  prohibitedInferences: ['continuous-motion', 'audio-content', 'measured-latency-or-control-rate',
    'benchmark-success-or-trial-denominator', 'model-execution-proof', 'autonomous-uninterrupted-operation',
    'causal-tactile-benefit', 'online-weight-update'],
  sourceRole: 'technical-resource-overview',
  authorSpeedStatement: 'Author-caption claim only; sampled PNGs do not measure real-time speed.',
  humanAssistance: 'The original dual-UR5e caption discloses human guidance in the plug-insertion episode.',
  humanoid: 'B-roll has no task prompt; the adjacent heading identifies an evaluation platform only.',
  printingAndPlotting: 'Frames are full original decoded rasters, not PDF pages or invented plots.',
  acceptance: 'Source-evidence preparation only. No report, scientific or publication acceptance.'
});
export const MP4_REVIEW_INSTRUCTIONS = `Inspect every one of the forty original decoded stills and its exact original caption/group statement. Copy each imageId, SHA256 and reviewRole; all three flags must be truthful. Four samples per MP4 are not full motion, continuous operation, audio inspection, measured latency/control rate, a benchmark success denominator, autonomy or model-execution proof. Distinguish source-authored claims from visible sampled states. Retain the plug-insertion human-guidance disclosure, work-in-progress continual adaptation, author-attributed real-time speed and prompt-free humanoid B-roll. A false/unreadable/mismatched item must fail. This packet is source-evidence preparation, not report acceptance; a future full report and all source/identity/visual evidence still require a fresh normal independent review.`;
export const mp4Hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const mp4CodeSha256 = mp4Hash(readFileSync(fileURLToPath(import.meta.url)));
const own = new WeakMap();
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const need = (ok, message) => { if (!ok) throw Error('Original MP4 evidence: ' + message); };
const same = (a, b, message) => need(isDeepStrictEqual(a, b), message);
const label = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s);
const PROFILE = 'microsoft-rho-alpha-january-2026-ten-clips';
const OFFICIAL = 'https://www.microsoft.com/en-us/research/story/advancing-ai-for-the-physical-world/';
const MEDIA_PREFIX = 'https://www.microsoft.com/en-us/research/wp-content/uploads/2026/01/';
const CLIPS = ['Action_Selects_Clip_01', 'Action_Selects_Clip_02', 'Action_Selects_Clip_04', 'Action_Selects_Clip_05',
  'Action_Selects_Clip_06_2', 'Action_Selects_Clip_10_1', 'Action_Selects_Clip_11', 'Action_Selects_Clip_12',
  'Action_Selects_Clip_13', 'B-roll_Selects_02_1'];
const keys = (o, expected, message) => same(Object.keys(o || {}).sort(), expected.split(' ').sort(), message);
function currentCode() { need(mp4Hash(readFileSync(fileURLToPath(import.meta.url))) === mp4CodeSha256, 'source module changed after import'); }
function decodeEntities(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll('&nbsp;', '\u00a0').replaceAll('&amp;', '&').replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}
const plain = s => decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
function exactRange(raw, p) {
  const chars = Array.from(raw);
  keys(p, 'startCharacter endCharacter sha256', 'unknown raw range field');
  need(Number.isSafeInteger(p.startCharacter) && Number.isSafeInteger(p.endCharacter) && p.startCharacter >= 0 &&
    p.endCharacter > p.startCharacter && p.endCharacter <= chars.length && hash(p.sha256), 'raw range bounds');
  const fragment = chars.slice(p.startCharacter, p.endCharacter).join('');
  need(mp4Hash(fragment) === p.sha256, 'raw HTML fragment drift');
  return fragment;
}
export async function mp4PinnedFile(workDir, p, maxBytes = 100_000_000) {
  keys(p, 'path sha256 bytes', 'unknown file pin field');
  need(typeof p.path === 'string' && !isAbsolute(p.path) && !p.path.includes('\\') && !p.path.split('/').includes('..') &&
    hash(p.sha256) && Number.isSafeInteger(p.bytes) && p.bytes > 0 && p.bytes <= maxBytes, 'unsafe or unbounded pin');
  const base = resolve(workDir);
  need(!(await lstat(base)).isSymbolicLink() && await realpath(base) === base, 'aliased work root');
  const file = resolve(base, p.path), rel = relative(base, file);
  need(rel && !isAbsolute(rel) && !rel.split(sep).includes('..'), 'escaped work root');
  let cursor = base;
  for (const part of rel.split(sep)) { cursor = join(cursor, part); need(!(await lstat(cursor)).isSymbolicLink(), 'symlink input'); }
  const st = await lstat(file);
  need(st.isFile() && st.nlink === 1 && st.size === p.bytes && await realpath(file) === file, 'aliased or changed-size input');
  const bytes = await readFile(file);
  need(mp4Hash(bytes) === p.sha256, 'input fingerprint drift: ' + p.path);
  return bytes;
}
function descriptorShape(d) {
  keys(d, 'schemaVersion policyVersion profile paperId canonicalUrl title source text manifest acquisition captionBindings nativeExtraction decoderSource scienceRecords groups clips temporalScope derivation', 'descriptor fields');
  need(d.schemaVersion === 1 && d.policyVersion === MP4_POLICY && d.profile === PROFILE && d.paperId === MP4_PAPER &&
    d.canonicalUrl === OFFICIAL && d.title === 'Advancing AI for the physical world' &&
    d.source.sha256 === MP4_SOURCE_SHA && d.text.sha256 === MP4_TEXT_SHA, 'source identity/profile mismatch');
  same(d.temporalScope, MP4_SCOPE, 'sampled-only scope changed');
  same(d.clips.map(c => c.id), CLIPS, 'ten-clip inventory/order mismatch');
  same(d.groups.map(g => g.id), ['busybox', 'dual-ur5', 'humanoid'], 'group statement inventory');
  need(d.derivation.preparationOnly === true && d.derivation.appliesPreferredTrackTransform === true &&
    d.derivation.preferredTimescale === 60000 && d.derivation.requestedTimeToleranceBefore === 0 &&
    d.derivation.requestedTimeToleranceAfter === 0, 'native extraction configuration changed');
  need(d.scienceRecords.length === 3, 'source-science lineage missing');
}
async function loadPack(workDir, descriptorPin) {
  currentCode();
  need(descriptorPin.sha256 === MP4_DESCRIPTOR_SHA, 'descriptor was not the frozen candidate');
  const bytes = await mp4PinnedFile(workDir, descriptorPin, 100_000), json = bytes.toString('utf8'), d = JSON.parse(json);
  descriptorShape(d);
  const pins = [descriptorPin, d.source, d.text, d.manifest, d.acquisition, d.captionBindings, d.nativeExtraction, d.decoderSource, ...d.scienceRecords];
  const files = new Map();
  for (const p of pins) files.set(p.path, await mp4PinnedFile(workDir, p));
  const raw = new TextDecoder('utf8', { fatal: true }).decode(files.get(d.source.path));
  const manifest = JSON.parse(files.get(d.manifest.path));
  need(manifest.paperId === MP4_PAPER && manifest.kind === 'html' && manifest.sha256 === MP4_SOURCE_SHA &&
    manifest.textSha256 === MP4_TEXT_SHA && manifest.scope === 'resource-overview' && manifest.canonicalUrl === OFFICIAL, 'source manifest identity/scope');
  const captions = JSON.parse(files.get(d.captionBindings.path)), acquisition = JSON.parse(files.get(d.acquisition.path)),
    extraction = JSON.parse(files.get(d.nativeExtraction.path));
  need(captions.length === 10 && extraction.length === 10 && acquisition.results.length === 11, 'original manifest inventory');
  for (const group of d.groups) same(exactRange(raw, group.rawRange), group.rawHtml, 'group caption changed');
  for (const c of d.clips) {
    keys(c, 'id group url media mimeType acquiredAt httpStatus caption rawRange durationSeconds frames', 'clip fields');
    need(c.url === MEDIA_PREFIX + c.id + '.mp4' && c.mimeType === 'video/mp4' && c.httpStatus === 200 &&
      d.groups.some(g => g.id === c.group), 'unapproved media URL/type/group');
    const markup = exactRange(raw, c.rawRange);
    need((markup.match(/<video\b/g) || []).length === 1 && markup.includes(`src="${c.url}"`) &&
      !/<(?:script|iframe|object|embed|audio|source)\b|\son[a-z]+\s*=/i.test(markup), 'not the exact inert original video node');
    const cap = markup.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/);
    same(cap ? plain(cap[1]) : '', c.caption, 'original caption mismatch');
    need((c.id === 'B-roll_Selects_02_1') === (c.caption === ''), 'invented/missing prompt');
    const cb = captions.find(x => x.url === c.url), a = acquisition.results.find(x => x.url === c.url),
      ex = extraction.find(x => basename(x.sourcePath) === c.id + '.mp4');
    same(cb, { url: c.url, caption: c.caption, rawHtmlCharStart: c.rawRange.startCharacter,
      rawHtmlCharEnd: c.rawRange.endCharacter, rawFragmentSha256: c.rawRange.sha256 }, 'caption record drift');
    need(a && a.finalUrl === c.url && a.sha256 === c.media.sha256 && a.bytes === c.media.bytes &&
      a.accessedAt === c.acquiredAt && a.contentType === 'video/mp4' && a.status === 200 &&
      a.path.endsWith('/' + c.media.path) && ex?.sourcePath === a.path, 'acquisition/native source chain');
    const mp4 = await mp4PinnedFile(workDir, c.media, 40_000_000);
    need(mp4.subarray(4, 8).toString() === 'ftyp', 'original is not an MP4 container');
    pins.push(c.media);
    need(Number.isFinite(c.durationSeconds) && c.durationSeconds > .3 && c.durationSeconds < 300 &&
      c.durationSeconds === ex.durationSeconds && c.frames.length === 4 && ex.frames.length === 4, 'duration/sample inventory');
    const target = [.1, c.durationSeconds / 3, c.durationSeconds * 2 / 3, c.durationSeconds - .1];
    let previous = -1;
    for (let n = 0; n < 4; n++) {
      const f = c.frames[n], old = ex.frames[n];
      keys(f, 'path sha256 bytes sampleIndex requestedSeconds actualSeconds width height', 'frame fields');
      need(f.sampleIndex === n && Number.isFinite(f.actualSeconds) && f.actualSeconds >= 0 &&
        f.actualSeconds < c.durationSeconds && f.actualSeconds > previous && Math.abs(f.requestedSeconds - target[n]) < 1e-12 &&
        Math.abs(f.actualSeconds - f.requestedSeconds) < .1 && f.width === 1920 && f.height === 1080, 'native time/size bounds');
      same(old, { path: old.path, requestedSeconds: f.requestedSeconds, actualSeconds: f.actualSeconds,
        width: f.width, height: f.height }, 'native frame record changed');
      need(old.path.endsWith('/' + f.path) && basename(f.path) === c.id + '-sample-' + n + '.png', 'native output lineage');
      const p = { path: f.path, sha256: f.sha256, bytes: f.bytes }, png = await mp4PinnedFile(workDir, p, 12_000_000);
      need(png.length > 32 && png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
        png.subarray(12,16).toString() === 'IHDR' && png.readUInt32BE(16) === f.width && png.readUInt32BE(20) === f.height,
        'not the bound full-size native PNG');
      pins.push(p); previous = f.actualSeconds;
    }
  }
  need(new Set(pins.map(p => p.path)).size === pins.length, 'duplicate input path');
  currentCode();
  return { workDir: resolve(workDir), descriptorPin, json, d, pins, codeSha256: mp4CodeSha256 };
}
export async function loadMp4SourcePlan({ workDir, descriptorPin, requestedIds }) {
  same(requestedIds, [MP4_PAPER], 'exact single source request required');
  const pack = await loadPack(workDir, descriptorPin), token = Object.freeze({});
  pack.issuedPackets = new Map(); pack.reviewIds = new Set(); own.set(token, pack); return token;
}
async function verified(token) {
  const pack = own.get(token); need(pack, 'plan is not coordinator-owned');
  const fresh = await loadPack(pack.workDir, pack.descriptorPin);
  same(fresh.pins, pack.pins, 'inputs changed after plan load');
  return pack;
}
function imagesFor(d, root) {
  return d.clips.flatMap(c => c.frames.map(f => ({
    imageId: 'mp4-' + c.id + '-' + f.sampleIndex, kind: 'source-mp4-frame', reviewRole: 'sampled-original-mp4-frame',
    path: resolve(root, f.path), sha256: f.sha256, width: f.width, height: f.height,
    locator: { kind: 'html-original-mp4-decoded-still', sourceUrl: d.canonicalUrl, sourceSha256: d.source.sha256,
      clipId: c.id, originalMp4Url: c.url, originalMp4Sha256: c.media.sha256, rawCaptionRange: c.rawRange,
      caption: c.caption, groupId: c.group, groupRawRange: d.groups.find(g => g.id === c.group).rawRange,
      originalGroupStatement: plain(d.groups.find(g => g.id === c.group).rawHtml),
      sampleIndex: f.sampleIndex, requestedSeconds: f.requestedSeconds, actualSeconds: f.actualSeconds,
      durationSeconds: c.durationSeconds, nativeExtractionSha256: d.nativeExtraction.sha256,
      decoderSourceSha256: d.decoderSource.sha256, descriptorSha256: MP4_DESCRIPTOR_SHA,
      scope: 'selected decoded still only; not continuous video, audio, speed, success rate or model execution' }
  })));
}
export async function prepareMp4ReviewPacket(token, { attemptId, reviewId }) {
  need(label(attemptId) && label(reviewId) && attemptId !== reviewId, 'fresh distinct review identifiers required');
  const pack = await verified(token);
  need(!pack.reviewIds.has(reviewId), 'review ID already issued by this plan');
  const packet = { schemaVersion: 1, sourceKind: 'html', paperId: MP4_PAPER, sourceSha256: MP4_SOURCE_SHA,
    policy: { version: MP4_POLICY, instructions: MP4_REVIEW_INSTRUCTIONS }, images: imagesFor(pack.d, pack.workDir),
    mp4Evidence: { version: MP4_POLICY, preparationOnly: true, descriptorJson: pack.json,
      descriptorSha256: MP4_DESCRIPTOR_SHA, codeSha256: mp4CodeSha256, evidenceRoot: pack.workDir,
      sourceTextSha256: MP4_TEXT_SHA, temporalScope: structuredClone(MP4_SCOPE), guardrails: structuredClone(MP4_GUARDRAILS),
      binding: { attemptId, reviewId, nonce: randomUUID(), createdAt: new Date().toISOString() },
      historicalExtractionOnly: true, nativeRuntimeFingerprintCaptured: false,
      completeReportReviewed: false, publicationAcceptance: false } };
  pack.reviewIds.add(reviewId);
  pack.issuedPackets.set(packet.mp4Evidence.binding.nonce, mp4Hash(JSON.stringify(packet)));
  return packet;
}
export function validateMp4Packet(packet) {
  currentCode();
  keys(packet, 'schemaVersion sourceKind paperId sourceSha256 policy images mp4Evidence', 'packet fields / mixed source profile');
  const p = packet.mp4Evidence;
  keys(p, 'version preparationOnly descriptorJson descriptorSha256 codeSha256 evidenceRoot sourceTextSha256 temporalScope guardrails binding historicalExtractionOnly nativeRuntimeFingerprintCaptured completeReportReviewed publicationAcceptance', 'MP4 evidence fields');
  need(packet.schemaVersion === 1 && packet.sourceKind === 'html' && packet.paperId === MP4_PAPER && packet.sourceSha256 === MP4_SOURCE_SHA &&
    p.version === MP4_POLICY && p.descriptorSha256 === MP4_DESCRIPTOR_SHA && mp4Hash(p.descriptorJson) === MP4_DESCRIPTOR_SHA &&
    p.codeSha256 === mp4CodeSha256 && p.sourceTextSha256 === MP4_TEXT_SHA, 'typed source/descriptor/code mismatch');
  same(packet.policy, { version: MP4_POLICY, instructions: MP4_REVIEW_INSTRUCTIONS }, 'review instructions changed');
  same(p.temporalScope, MP4_SCOPE, 'unsupported temporal evidence assertion');
  same(p.guardrails, MP4_GUARDRAILS, 'scientific scope guardrails changed');
  need(p.preparationOnly === true && p.historicalExtractionOnly === true && p.nativeRuntimeFingerprintCaptured === false &&
    p.completeReportReviewed === false && p.publicationAcceptance === false, 'preparation promoted to acceptance/runtime proof');
  keys(p.binding, 'attemptId reviewId nonce createdAt', 'review binding fields');
  need(label(p.binding.attemptId) && label(p.binding.reviewId) && p.binding.attemptId !== p.binding.reviewId &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.binding.nonce) && Number.isFinite(Date.parse(p.binding.createdAt)), 'review identity missing');
  need(typeof p.evidenceRoot === 'string' && isAbsolute(p.evidenceRoot) && resolve(p.evidenceRoot) === p.evidenceRoot, 'evidence root');
  const d = JSON.parse(p.descriptorJson); descriptorShape(d);
  same(packet.images, imagesFor(d, p.evidenceRoot), 'missing, extra, reordered or changed original frame/caption/role');
  need(packet.images.length === 40 && new Set(packet.images.map(i => i.imageId)).size === 40 &&
    new Set(packet.images.map(i => i.sha256)).size === 40, 'exact forty unique original frames required');
  return true;
}
export async function verifyMp4PacketCurrent(token, packet) {
  const pack = await verified(token); validateMp4Packet(packet);
  need(pack.issuedPackets.get(packet.mp4Evidence.binding.nonce) === mp4Hash(JSON.stringify(packet)), 'packet was not freshly issued by this coordinator plan');
  need(packet.mp4Evidence.evidenceRoot === pack.workDir && packet.mp4Evidence.descriptorJson === pack.json, 'packet not from this source plan');
  return true;
}
