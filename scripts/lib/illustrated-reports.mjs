import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const fail = message => { throw new Error(`Illustrated report: ${message}`); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function validateIllustratedReport(edition, report) {
  if (!edition || edition.schemaVersion !== 1 || edition.paperId !== report?.paperId) fail('unknown schema or mismatched paper identity');
  for (const key of ['shortTitle', 'thesis', 'standfirst']) if (!nonempty(edition[key])) fail(`${key} is required`);
  const serialized = JSON.stringify(edition);
  if (/[\u3400-\u9fff]/u.test(serialized)) fail('website prose must be English');
  if (/\/Users\/|reading_work\/|file:\/\/|[a-z]+_secret_[\w-]+/i.test(serialized)) fail('private source paths or credentials must not be published');
  const knownEvidence = new Set(report.evidence.map(item => item.id));
  const references = (item, name) => {
    if (!Array.isArray(item.evidenceIds) || !item.evidenceIds.length || item.evidenceIds.some(id => !knownEvidence.has(id))) fail(`${name} needs valid source evidence`);
  };
  references(edition, 'introduction');
  if (!Array.isArray(edition.visuals) || edition.visuals.length < 4 || edition.visuals.length > 6) fail('each pilot needs four to six original visuals');
  const ids = new Set();
  for (const visual of edition.visuals) {
    if (!/^[a-z0-9-]+$/.test(visual.id) || ids.has(visual.id)) fail('duplicate or unsafe visual ID');
    ids.add(visual.id);
    if (!['figure', 'table'].includes(visual.kind) || !['mechanism', 'results', 'ablation'].includes(visual.section)) fail(`${visual.id}: invalid visual type or section`);
    if (!new RegExp(`^report-assets/${edition.paperId.replaceAll('.', '\\.')}/[a-z0-9-]+\\.png$`).test(visual.asset)) fail(`${visual.id}: unsafe asset path`);
    for (const key of ['sourceLabel', 'alt', 'caption', 'readingGuide', 'takeaway', 'caution']) if (!nonempty(visual[key])) fail(`${visual.id}: ${key} is required`);
    if (![visual.width, visual.height, visual.page].every(value => Number.isInteger(value) && value > 0)) fail(`${visual.id}: invalid image dimensions or PDF page`);
    const source = report.sources.find(item => item.sha256 === visual.sourceSha256);
    if (!source || visual.sourceUrl !== `${source.url.split('#')[0]}#page=${visual.page}`) fail(`${visual.id}: source URL, page or fingerprint does not match the verified report`);
    const c = visual.crop;
    if (!Array.isArray(c) || c.length !== 4 || c.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) || c[0] >= c[2] || c[1] >= c[3]) fail(`${visual.id}: invalid normalized crop`);
    references(visual, visual.id);
  }
  if (!['mechanism', 'results', 'ablation'].every(section => edition.visuals.some(visual => visual.section === section))) fail('include method, result and ablation/diagnostic visuals');
  if (!edition.visuals.some(visual => visual.kind === 'table')) fail('an original quantitative table is required');
  if (!Array.isArray(edition.walkthrough) || edition.walkthrough.length !== 3) fail('three tutorial steps are required');
  for (const step of edition.walkthrough) {
    if (!nonempty(step.heading) || !nonempty(step.text) || !['source', 'author-claim', 'analysis', 'open-question'].includes(step.kind)) fail('invalid walkthrough');
    references(step, 'walkthrough');
  }
  if (!Array.isArray(edition.reproductionChecks) || edition.reproductionChecks.length !== 2) fail('two proposed reproduction checks are required');
  for (const check of edition.reproductionChecks) {
    if (!nonempty(check.title) || !nonempty(check.text)) fail('invalid reproduction proposal');
    references(check, 'reproduction proposal');
  }
  if (!edition.visualAudit || !nonempty(edition.visualAudit.notes) || !Array.isArray(edition.visualAudit.inspectedPages) || edition.visualAudit.inspectedPages.some(page => !Number.isInteger(page) || page < 1) || edition.visuals.some(visual => !edition.visualAudit.inspectedPages.includes(visual.page))) fail('every cropped page needs a recorded visual audit');
  return edition;
}

export async function validateIllustratedCollection(repository, reports) {
  const pilot = JSON.parse(await readFile(join(repository, 'data/report-pilot.json'), 'utf8'));
  const files = (await readdir(join(repository, 'data/illustrated-reports'))).filter(file => file.endsWith('.json'));
  if (new Set(pilot.paperIds).size !== 10 || pilot.paperIds.length !== 10) fail('the pilot must contain exactly ten unique IDs');
  if (files.length !== pilot.paperIds.length || files.some(file => !pilot.paperIds.includes(file.slice(0, -5)))) fail('only the ten approved pilot IDs may be redesigned before review; all ten must be present');
  const accepted = [];
  for (const file of files) {
    const edition = JSON.parse(await readFile(join(repository, 'data/illustrated-reports', file), 'utf8'));
    if (file !== `${edition.paperId}.json`) fail('filename and paper ID differ');
    validateIllustratedReport(edition, reports.find(report => report.paperId === edition.paperId));
    for (const visual of edition.visuals) {
      const data = await readFile(join(repository, 'public', visual.asset));
      if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(16) !== visual.width || data.readUInt32BE(20) !== visual.height) fail(`${visual.asset}: PNG dimensions do not match the image record`);
    }
    accepted.push(edition);
  }
  return accepted;
}
