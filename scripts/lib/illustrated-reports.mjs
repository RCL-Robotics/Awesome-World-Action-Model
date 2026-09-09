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
  if (edition.featuredResultTask !== undefined && (!nonempty(edition.featuredResultTask) || !report.results.some(result => result.task === edition.featuredResultTask))) fail('featuredResultTask must name an existing reported result');
  const hasVisualLimitations = edition.visualLimitations !== undefined;
  if (hasVisualLimitations) {
    const limitation = edition.visualLimitations;
    if (!limitation || !nonempty(limitation.text) || !['source', 'analysis'].includes(limitation.kind)) fail('visualLimitations needs an explicit source-grounded explanation');
    references(limitation, 'visual limitations');
  }
  if (!Array.isArray(edition.visuals) || edition.visuals.length < 1 || edition.visuals.length > 6 || (!hasVisualLimitations && edition.visuals.length < 4)) fail('each report needs four to six original visuals unless source-grounded visual limitations are recorded; at least one original visual is required');
  if (report.coverage.scope === 'abstract-only') fail('abstract-only sources cannot be accepted as illustrated reports');
  const ids = new Set();
  for (const visual of edition.visuals) {
    if (!/^[a-z0-9-]+$/.test(visual.id) || ids.has(visual.id)) fail('duplicate or unsafe visual ID');
    ids.add(visual.id);
    if (!['figure', 'table'].includes(visual.kind) || !['mechanism', 'results', 'ablation'].includes(visual.section)) fail(`${visual.id}: invalid visual type or section`);
    if (!new RegExp(`^report-assets/${edition.paperId.replaceAll('.', '\\.')}/[a-z0-9-]+\\.png$`).test(visual.asset)) fail(`${visual.id}: unsafe asset path`);
    for (const key of ['sourceLabel', 'alt', 'caption', 'readingGuide', 'takeaway', 'caution']) if (!nonempty(visual[key])) fail(`${visual.id}: ${key} is required`);
    if (![visual.width, visual.height].every(value => Number.isInteger(value) && value > 0)) fail(`${visual.id}: invalid image dimensions`);
    const source = report.sources.find(item => item.sha256 === visual.sourceSha256);
    if (source?.kind === 'html' && visual.htmlSource) {
      const locator = visual.htmlSource;
      const native=['html-original-table','html-gif-derived-still'].includes(locator.kind);
      if(native&&(edition.paperId!=='ref-236eff7a0d0d26ae758e'||locator.policyVersion!=='wam-openscene-original-html-gif-evidence-v1'||locator.sourceId!==source.id||locator.sourceSha256!==source.sha256||!['readme','dataset_stats','challenge_2024','getting_started'].includes(locator.documentId)||locator.sourceBundleSha256!=='eca200b677f40fa93987ee0aeef6d52e9702260865393b12d70e3796eb73e6fd'||locator.recipeSha256!=='f4858135945364329e9ba1e68d827b208e67dd90f68771827e70a23a73c2178a'))fail('Unbound native document/source locator');
      if(locator.kind==='html-gif-derived-still'&&([locator.frameIndex,locator.timeMs,locator.loopIteration].some(n=>n!==0)||locator.nativeWidth!==960||locator.nativeHeight!==540||locator.authoredHtmlWidth!=='996px'||locator.originalAssetUrl!=='https://raw.githubusercontent.com/OpenDriveLab/OpenScene/72860746787a67946bef07aa1f78bbbc6b20e445/assets/OpenScene_data_stats.gif'||locator.framePngSha256!=='1554706d8304f665ef7261af47ed84f35fdfcb6837663b0c648a652c1914c9a9'||locator.rgbaSha256!=='d4687cf21eaad0c9883b659577c5c16ef9918143a97e40fdd9c17bb013df969c'))fail('Unbound original GIF frame locator');
      if (visual.page !== undefined || visual.crop !== undefined || !['html-original','html-original-raster','html-animation-derived-still','html-original-table','html-gif-derived-still'].includes(locator.kind) || !/^[a-z0-9-]+$/.test(locator.fragmentId) || !(locator.anchor===null && (native||locator.mediaPolicyVersion==='wam-original-html-media-evidence-v1') || /^[a-z0-9-]+$/.test(locator.anchor)) || visual.sourceUrl !== `${source.url.split('#')[0]}${locator.anchor===null?'':'#'+locator.anchor}`) fail(`${visual.id}: invalid HTML source locator; no PDF page or crop is permitted`);
      if (!native && locator.kind!=='html-original' && (locator.mediaPolicyVersion!=='wam-original-html-media-evidence-v1' || !/^[a-f0-9]{64}$/.test(locator.mediaCodeSha256) || !/^[a-f0-9]{64}$/.test(locator.originalAssetSha256))) fail('Unbound original media locator');
      for (const key of ['descriptorSha256', 'wrapperSha256', 'rendererSha256', 'rendererCodeSha256']) if (!/^[a-f0-9]{64}$/.test(locator[key] || '')) fail(`${visual.id}: missing HTML provenance`);
      if (!Array.isArray(locator.parts) || !locator.parts.length || locator.parts.some(p => !Number.isInteger(p.startCharacter) || !Number.isInteger(p.endCharacter) || p.startCharacter < 0 || p.endCharacter <= p.startCharacter || !/^[a-f0-9]{64}$/.test(p.sha256 || ''))) fail(`${visual.id}: invalid HTML source ranges`);
      if (!nonempty(visual.sourceRendering)) fail(`${visual.id}: HTML extraction needs a wrapper disclosure`);
    } else {
      if (visual.htmlSource !== undefined || !Number.isInteger(visual.page) || visual.page < 1 || !source || source.kind !== 'pdf' || visual.sourceUrl !== `${source.url.split('#')[0]}#page=${visual.page}`) fail(`${visual.id}: source URL, PDF page or fingerprint does not match the verified report`);
      const c = visual.crop;
      if (!Array.isArray(c) || c.length !== 4 || c.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) || c[0] >= c[2] || c[1] >= c[3]) fail(`${visual.id}: invalid normalized crop`);
    }
    references(visual, visual.id);
  }
  if (!hasVisualLimitations && !['mechanism', 'results', 'ablation'].every(section => edition.visuals.some(visual => visual.section === section))) fail('include method, result and ablation/diagnostic visuals');
  if (!hasVisualLimitations && !edition.visuals.some(visual => visual.kind === 'table')) fail('an original quantitative table is required');
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
  if (report.sources[0]?.kind === 'html') {
    const audit = edition.visualAudit;
    if (!audit || !nonempty(audit.notes) || audit.inspectedPages !== undefined || !Array.isArray(audit.inspectedSections) || !audit.inspectedSections.length || new Set(audit.inspectedSections).size !== audit.inspectedSections.length || audit.inspectedSections.some(id => !/^[a-z0-9-]+$/.test(id)) || !audit.htmlEvidence || typeof audit.htmlEvidence !== 'object') fail('HTML evidence needs inspected supporting sections, without invented PDF pages');
    for (const item of report.evidence) if (!Array.isArray(audit.htmlEvidence[item.id]) || !audit.htmlEvidence[item.id].length || audit.htmlEvidence[item.id].some(id => !audit.inspectedSections.includes(id))) fail('every HTML evidence claim needs a supporting section');
    if (Object.keys(audit.htmlEvidence).some(id => !knownEvidence.has(id))) fail('unknown HTML evidence ID');
  } else if (!edition.visualAudit || !nonempty(edition.visualAudit.notes) || !Array.isArray(edition.visualAudit.inspectedPages) || edition.visualAudit.inspectedPages.some(page => !Number.isInteger(page) || page < 1) || edition.visuals.some(visual => !edition.visualAudit.inspectedPages.includes(visual.page))) fail('every cropped page needs a recorded visual audit');
  return edition;
}

export function validateIllustratedMetadata(metadata, report) {
  if (!metadata || !nonempty(metadata.authors) || metadata.sourceSha256 !== report?.sources?.[0]?.sha256) fail(`${report?.paperId}: verified title-block metadata must match the primary source`);
  if (metadata.affiliations !== undefined && !nonempty(metadata.affiliations)) fail(`${report.paperId}: omit unverified affiliations`);
  if (metadata.page !== undefined && (!Number.isInteger(metadata.page) || metadata.page < 1)) fail(`${report.paperId}: invalid title-block page`);
  if (metadata.location !== undefined && !nonempty(metadata.location)) fail(`${report.paperId}: invalid title-block location`);
  if (metadata.page === undefined && !nonempty(metadata.location)) fail(`${report.paperId}: a title-block page or source location is required`);
  if (/\/Users\/|reading_work\/|file:\/\/|[a-z]+_secret_[\w-]+/i.test(JSON.stringify(metadata))) fail('private source paths or credentials must not be published');
  return metadata;
}

export async function validateIllustratedCollection(repository, reports) {
  const pilot = JSON.parse(await readFile(join(repository, 'data/report-pilot.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(join(repository, 'data/illustrated-report-metadata.json'), 'utf8'));
  const files = (await readdir(join(repository, 'data/illustrated-reports'))).filter(file => file.endsWith('.json'));
  if (!['awaiting-user-review', 'approved'].includes(pilot.state)) fail('unknown pilot review state');
  if (!Array.isArray(pilot.paperIds) || new Set(pilot.paperIds).size !== 10 || pilot.paperIds.length !== 10) fail('the pilot must contain exactly ten unique IDs');
  if (pilot.paperIds.some(id => !files.includes(`${id}.json`))) fail('all ten pilot reports must remain present');
  if (pilot.state !== 'approved' && files.some(file => !pilot.paperIds.includes(file.slice(0, -5)))) fail('only the ten pilot IDs may be redesigned before user approval');
  if (pilot.state === 'approved' && (!nonempty(pilot.approvedAt) || !Number.isFinite(Date.parse(pilot.approvedAt)) || !nonempty(pilot.reason))) fail('approval needs a recorded time and reason');
  const accepted = [];
  for (const file of files) {
    const edition = JSON.parse(await readFile(join(repository, 'data/illustrated-reports', file), 'utf8'));
    if (file !== `${edition.paperId}.json`) fail('filename and paper ID differ');
    const report = reports.find(report => report.paperId === edition.paperId);
    validateIllustratedReport(edition, report);
    validateIllustratedMetadata(metadata[edition.paperId], report);
    for (const visual of edition.visuals) {
      const data = await readFile(join(repository, 'public', visual.asset));
      if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(16) !== visual.width || data.readUInt32BE(20) !== visual.height) fail(`${visual.asset}: PNG dimensions do not match the image record`);
    }
    accepted.push(edition);
  }
  return accepted;
}
