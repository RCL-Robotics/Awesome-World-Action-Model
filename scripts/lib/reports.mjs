import {validateOpenSceneSources} from './openscene-original-evidence.mjs';
import { readFile, readdir, mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { safeUrl } from './data.mjs';
export { classificationSnapshot } from '../../src/lib/classification-snapshot.mjs';
export const ROOT = new URL('../../', import.meta.url);
const schema = JSON.parse(await readFile(new URL('schemas/reading-report.schema.json', ROOT), 'utf8'));
export const hashText = text => createHash('sha256').update(text).digest('hex');
export async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function writeJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}
function structure(value, rule, at = 'report') {
  const type = rule.type;
  const valid = type === 'array' ? Array.isArray(value) : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : typeof value === type;
  if (!valid) throw new Error(`${at}: expected ${type}`);
  if (rule.enum && !rule.enum.includes(value)) throw new Error(`${at}: unknown value`);
  if (Object.hasOwn(rule, 'const') && value !== rule.const) throw new Error(`${at}: wrong schema version`);
  if (rule.minimum !== undefined && value < rule.minimum) throw new Error(`${at}: below minimum`);
  if (type === 'array') {
    if (rule.minItems && value.length < rule.minItems) throw new Error(`${at}: too few items`);
    value.forEach((item, index) => structure(item, rule.items, `${at}[${index}]`));
  }
  if (type === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value, key)) throw new Error(`${at}: missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (!rule.properties[key]) throw new Error(`${at}: unexpected field ${key}`);
      structure(item, rule.properties[key], `${at}.${key}`);
    }
  }
}
export function validateReport(report, { paperIds, manifest, verifiedHtmlSources } = {}) {
  structure(report, schema);
  if (!/^[a-zA-Z0-9._-]+$/.test(report.paperId)) throw new Error('Unsafe report identity');
  if (paperIds && !paperIds.has(report.paperId)) throw new Error('Report does not belong to this catalog');
  if (!report.coverage.identityVerified) throw new Error('Source identity has not been verified');
  if (!Number.isFinite(Date.parse(report.generatedAt))) throw new Error('Invalid generation date');
  if (!/^[a-f0-9]{64}$/.test(report.taxonomy.recordedClassification.fingerprint) || !Number.isFinite(Date.parse(report.taxonomy.recordedClassification.catalogUpdatedAt))) throw new Error('Missing catalog snapshot provenance');
  const sourceIds = new Set();
  for (const source of report.sources) {
    if (!source.id || sourceIds.has(source.id)) throw new Error('Duplicate or empty source ID');
    sourceIds.add(source.id);
    let url; try { url = new URL(source.url); } catch { throw new Error('Invalid source URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe source URL');
    if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Invalid source fingerprint');
    if (!source.title.trim() || !Number.isFinite(Date.parse(source.accessedAt))) throw new Error('Missing source provenance');
  }
  const evidenceIds = new Set();
  for (const evidence of report.evidence) {
    if (!evidence.id || evidenceIds.has(evidence.id)) throw new Error('Duplicate or empty evidence ID');
    if (!sourceIds.has(evidence.sourceId)) throw new Error('Evidence has an unknown source');
    if (!evidence.location.trim() || !evidence.detail.trim()) throw new Error('Evidence needs a location and supporting detail');
    evidenceIds.add(evidence.id);
  }
  function walk(value) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'evidenceIds')) {
      for (const id of value.evidenceIds) if (!evidenceIds.has(id)) throw new Error(`Unresolved evidence: ${id}`);
      if (value.kind !== 'open-question' && !value.evidenceIds.length) throw new Error('A substantive claim has no evidence');
    }
    Object.values(value).forEach(walk);
  }
  walk(report);
  if (report.relatedPaperIds.some(id => paperIds && !paperIds.has(id))) throw new Error('Related paper is outside the catalog');
  if (report.reportStatus === 'full-text-reviewed' && report.coverage.scope !== 'full-paper') throw new Error('Full-text status overstates coverage');
  if (report.reportStatus === 'partial-text-reviewed' && report.coverage.scope === 'full-paper') throw new Error('Partial status needs a partial reading scope');
  if (report.reportStatus === 'resource-reviewed' && report.coverage.scope !== 'resource-overview') throw new Error('Resource status needs documentation scope');
  if (report.reportStatus === 'full-text-reviewed' && report.resourceType === 'book') throw new Error('A book must identify the reviewed chapter scope');
  if (report.coverage.scope === 'abstract-only' && (report.results.length || report.method.steps.length || report.method.training.length || report.method.inference.length || report.method.equations.length || report.coverage.figuresReviewed.length || report.coverage.tablesReviewed.length || !['unclear', 'not-applicable'].includes(report.taxonomy.assessment))) throw new Error('An abstract-only reading cannot support detailed results, method or visual inspection');
  if (manifest) {
    if (manifest.paperId !== report.paperId || !['full-text', 'partial-text'].includes(manifest.accessStatus)) throw new Error('No readable source manifest for this report');
    if (manifest.titleMatch !== true) throw new Error('Manifest identity is not verified');
    const primary = report.sources[0];
    if (verifiedHtmlSources) { validateOpenSceneSources(manifest,verifiedHtmlSources); if(JSON.stringify(report.sources)!==JSON.stringify(verifiedHtmlSources))throw new Error('Report sources differ from verified four-document inventory'); }
    else if (report.sources.length !== 1) throw new Error('Report cites a source not supplied to this text-only reading');
    if (primary.sha256 !== manifest.sha256 || primary.url !== manifest.canonicalUrl || primary.wordCount !== manifest.wordCount || (manifest.observedTitle && primary.title !== manifest.observedTitle) || (manifest.kind && primary.kind !== manifest.kind) || (manifest.accessedAt && Date.parse(primary.accessedAt) !== Date.parse(manifest.accessedAt))) throw new Error('Report provenance differs from the supplied source');
    if (manifest.accessStatus !== 'full-text' && report.reportStatus === 'full-text-reviewed') throw new Error('A partial source cannot produce a full-text review');
    if (manifest.readingMode === 'text-only' && report.coverage.figuresReviewed.length) throw new Error('Text-only reading cannot claim visual figure inspection');
    for (const omission of manifest.omissions || []) if (!report.coverage.omissions.includes(omission)) throw new Error('Known source omissions must be preserved');
    if (manifest.scope === 'abstract-only' && report.coverage.scope !== 'abstract-only') throw new Error('Reading coverage overstates an abstract-only source');
  }
  const humanText = JSON.stringify(report);
  if (/[\u3400-\u9fff]/u.test(humanText)) throw new Error('Report must be English');
  if (/\/(?:Users|home|private\/(?:tmp|var)|tmp|var\/folders)\/|file:\/\/|secret_[A-Za-z0-9]|ntn_[A-Za-z0-9]/.test(humanText)) throw new Error('Private data in report');
  return report;
}
export async function loadReports(directory, options = {}) {
  await mkdir(directory, { recursive: true });
  const reports = [];
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
    const report = validateReport(await readJSON(join(directory, file)), options);
    if (file !== `${report.paperId}.json`) throw new Error(`Report filename mismatch: ${file}`);
    reports.push(report);
  }
  return reports;
}
export function validateReadingIndex(index, { paperIds } = {}) {
  if (index.schemaVersion !== 1 || !Number.isFinite(Date.parse(index.updatedAt)) || !Array.isArray(index.entries)) throw new Error('Invalid reading index');
  const seen = new Set();
  for (const entry of index.entries) {
    const fields = ['paperId', 'accessStatus', 'readingStatus', 'sourceUrl', 'reason'];
    if (Object.keys(entry).length !== fields.length || fields.some(field => !Object.hasOwn(entry, field))) throw new Error('Unexpected reading index fields');
    if (seen.has(entry.paperId) || (paperIds && !paperIds.has(entry.paperId))) throw new Error('Unknown or duplicate reading index identity');
    seen.add(entry.paperId);
    if (!['pending', 'full-text', 'partial-text', 'unavailable', 'identity-mismatch'].includes(entry.accessStatus) || !['queued', 'reviewed', 'partial', 'resource', 'unavailable', 'identity-mismatch', 'error'].includes(entry.readingStatus)) throw new Error('Unknown reading index status');
    if (entry.sourceUrl !== null) safeUrl(entry.sourceUrl, 'Reading source URL');
    if (typeof entry.reason !== 'string') throw new Error('Invalid reading index explanation');
  }
  if (paperIds && seen.size !== paperIds.size) throw new Error('Reading index does not cover the entire catalog');
  let serialized = JSON.stringify(index);
  try { serialized = decodeURIComponent(serialized); } catch { /* Non-URL prose may contain a literal percent sign. */ }
  if (/\/(?:Users|home|private\/(?:tmp|var)|tmp|var\/folders)\/|file:\/\/|secret_[A-Za-z0-9]|ntn_[A-Za-z0-9]/.test(serialized)) throw new Error('Private data in reading index');
  if (/[\u3400-\u9fff]/u.test(serialized)) throw new Error('Reading index must be English');
  return index;
}
export async function readingIndexSnapshot({ repository, workDir }) {
  const papers = await readJSON(join(repository, 'data/papers.json'));
  const ids = new Set(papers.map(p => p.id));
  const reports = new Map((await loadReports(join(repository, 'data/reports'), { paperIds: ids })).map(r => [r.paperId, r]));
  const entries = [];
  for (const paper of papers) {
    let source; try { source = await readJSON(join(workDir, 'sources', paper.id, 'manifest.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let run; try { run = await readJSON(join(workDir, 'runs', `${paper.id}.status.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const report = reports.get(paper.id);
    const accessStatus = source?.accessStatus || 'pending';
    let readingStatus = accessStatus === 'unavailable' || accessStatus === 'identity-mismatch' ? accessStatus : run?.status === 'error' ? 'error' : 'queued';
    let reason = ({ pending: 'Source retrieval is queued.', 'full-text': 'Full text is available; reading is queued.', 'partial-text': 'Only part of the source is available; reading is queued.', unavailable: 'A readable primary source could not be retrieved.', 'identity-mismatch': 'The retrieved source could not be matched to this reference.' })[accessStatus] || 'Source verification is pending.';
    if (run?.status === 'error') reason = 'The reading attempt did not pass validation and needs another review.';
    if (report) {
      readingStatus = ({ 'full-text-reviewed': 'reviewed', 'partial-text-reviewed': 'partial', 'resource-reviewed': 'resource' })[report.reportStatus];
      reason = ({ reviewed: 'Full paper text reviewed; see the report for appendix and figure coverage.', partial: 'Partial reading; the report identifies the sections inspected.', resource: 'Resource documentation reviewed within the stated scope.' })[readingStatus];
    }
    entries.push({ paperId: paper.id, accessStatus: report && accessStatus === 'pending' ? report.reportStatus === 'full-text-reviewed' ? 'full-text' : 'partial-text' : accessStatus, readingStatus, sourceUrl: report?.sources[0]?.url || source?.canonicalUrl || paper.paperUrl, reason });
  }
  return validateReadingIndex({ schemaVersion: 1, updatedAt: new Date().toISOString(), entries }, { paperIds: ids });
}
export async function updateReadingIndex({ repository, workDir }) {
  const next = await readingIndexSnapshot({ repository, workDir });
  const path = join(repository, 'data/reading-index.json');
  let previous; try { previous = await readJSON(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (JSON.stringify(previous?.entries) !== JSON.stringify(next.entries)) await writeJSON(path, next);
  return next.entries;
}
