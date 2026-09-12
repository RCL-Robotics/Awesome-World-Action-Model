import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MAJOR_CATEGORIES, COMPONENT_AREAS, componentSubcategory, QUADRANT_STATUSES, ARCHITECTURES, PREDICTION_PARADIGMS, CLASSIFICATION_STATUSES, QUADRANT_AXES, taxonomyLabel } from '../../src/lib/taxonomy.mjs';

export const CATEGORIES = Object.freeze([
  'General WAM', 'Memory WAM', 'WAM + RL', '3D/4D WAM',
  'Latent / Representation WAM', 'Multimodal / Tactile WAM',
  'Navigation / Driving / Domain WAM', 'Real-Time / Efficient WAM',
  'Evaluation / Survey / Theory',
]);

export const LEGACY_PUBLIC_FIELDS = Object.freeze([
  'id', 'title', 'authors', 'affiliations', 'contribution', 'abstract',
  'submittedDate', 'primaryCategory', 'secondaryCategories', 'bibtexKey',
  'arxivUrl', 'codeUrls', 'projectUrl', 'venue',
]);
export const REFERENCE_PUBLIC_FIELDS = Object.freeze([
  ...LEGACY_PUBLIC_FIELDS, 'paperUrl', 'pdfUrl', 'doi', 'publicationYear', 'bibtex',
]);
export const TAXONOMY_FIELDS = Object.freeze([
  'majorCategory', 'subcategories', 'architecture', 'predictionParadigm', 'quadrant', 'classificationStatus',
]);
export const PUBLIC_FIELDS = Object.freeze([...REFERENCE_PUBLIC_FIELDS, ...TAXONOMY_FIELDS]);
export const UNCATEGORIZED = 'Uncategorized';

export function propertyText(property) {
  if (!property) return '';
  if (property.type === 'select') return property.select?.name ?? '';
  if (property.type === 'url') return property.url ?? '';
  const fragments = property.title ?? property.rich_text ?? [];
  return fragments.map((item) => item.plain_text ?? item.text?.content ?? item.equation?.expression ?? '').join('');
}

export function safeUrl(value, label = 'URL') {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty URL`);
  const trimmed = value.trim();
  let parsed;
  try { parsed = new URL(trimmed); } catch { throw new Error(`${label} is not a valid absolute URL`); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label} must use HTTP(S), without embedded credentials`);
  }
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) throw new Error(`${label} contains whitespace or control characters`);
  return trimmed;
}

export function arxivIdentity(value) {
  const parsed = new URL(safeUrl(value, 'Paper URL'));
  if (!['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('Paper URL must point to arxiv.org');
  }
  const match = parsed.pathname.match(/^\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?\/?$/i);
  if (!match) throw new Error('Paper URL does not contain a valid arXiv identifier');
  return { id: match[1], arxivUrl: `https://arxiv.org/abs/${match[1]}` };
}

// Use standard URL serialization, retaining query order but discarding page fragments.
// IDs depend only on this public URL, never on an editor or Notion page identity.
export function paperIdentity(value) {
  const parsed = new URL(safeUrl(value, 'Paper URL'));
  if (['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'].includes(parsed.hostname.toLowerCase())) {
    const identity = arxivIdentity(value);
    return { ...identity, paperUrl: identity.arxivUrl };
  }
  parsed.hash = '';
  const paperUrl = parsed.toString();
  return { id: `ref-${createHash('sha256').update(paperUrl).digest('hex').slice(0, 20)}`, arxivUrl: null, paperUrl };
}

export function normalizeDoi(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim().replace(/^doi:\s*/i, '');
  const parsed = new URL(safeUrl(/^10\.\d{4,9}\//.test(input) ? `https://doi.org/${input}` : input, 'DOI'));
  if (!['doi.org', 'dx.doi.org', 'www.doi.org'].includes(parsed.hostname.toLowerCase()) || !/^\/10\.\d{4,9}\/\S+$/.test(parsed.pathname) || parsed.search) {
    throw new Error('DOI must be a DOI identifier or a doi.org URL containing a DOI identifier');
  }
  parsed.protocol = 'https:';
  parsed.host = 'doi.org';
  parsed.hash = '';
  return parsed.toString();
}

// Handles plain URLs, Markdown links, and linked Notion rich-text labels.
export function propertyUrls(property) {
  const visible = propertyText(property);
  const fragments = property?.rich_text ?? property?.title ?? [];
  const linked = fragments.flatMap((part) => [part.href, part.text?.link?.url].filter(Boolean));
  if (!linked.length && /^\s*(?:none|n\/a|null|not available)?\s*$/i.test(visible)) return [];
  const found = visible.replace(/,\s*(?=https?:\/\/)/gi, '\n').match(/https?:\/\/[^\s<>"\u3001\uFF0C;]+/gi) ?? [];
  const cleaned = found.map((url) => {
    let result = url.replace(/[.,;]+$/, '');
    // Markdown wrappers/prose punctuation can close a URL; balanced URL parentheses remain intact.
    while (result.endsWith(')') && (result.match(/\)/g) ?? []).length > (result.match(/\(/g) ?? []).length) result = result.slice(0, -1);
    return result.replace(/\]+$/, '');
  });
  const urls = [...new Set([...cleaned, ...linked].map((url) => safeUrl(url, 'Code URL')))];
  if (!urls.length && visible.trim()) throw new Error('Code URL contains text but no HTTP(S) URL');
  return urls;
}

export function mapNotionPage(page) {
  if (page.object !== 'page' || !page.properties) throw new Error('Expected a full Notion page with properties');
  if (page.archived || page.in_trash) throw new Error('Archived pages must not be exported');
  const p = page.properties;
  const identity = paperIdentity(propertyText(p['Paper URL']));
  const project = propertyText(p['Web Page']).trim();
  const pdf = propertyText(p['PDF URL']).trim();
  const venue = propertyText(p['论文收录']);
  return {
    id: identity.id,
    title: propertyText(p['Paper Name']),
    authors: propertyText(p.Authors),
    affiliations: propertyText(p['Author Affiliations']),
    contribution: propertyText(p.Contribution),
    abstract: propertyText(p['English Abstract']),
    submittedDate: p['Submitted Date']?.date?.start ?? null,
    primaryCategory: p['Primary Category']?.select?.name || UNCATEGORIZED,
    secondaryCategories: (p['Secondary Categories']?.multi_select ?? []).map((entry) => entry.name).filter((name) => name !== 'None'),
    bibtexKey: propertyText(p['BibTeX Key']),
    arxivUrl: identity.arxivUrl,
    codeUrls: propertyUrls(p['Code URL']),
    projectUrl: project ? safeUrl(project, 'Web Page') : null,
    venue: venue.trim() ? venue : null,
    paperUrl: identity.paperUrl,
    pdfUrl: pdf ? safeUrl(pdf, 'PDF URL') : null,
    doi: normalizeDoi(propertyText(p.DOI)),
    publicationYear: p['Publication Year']?.number ?? null,
    bibtex: propertyText(p.BibTeX),
    majorCategory: p['大类']?.select?.name || null,
    subcategories: (p['小类']?.multi_select ?? []).map((entry) => entry.name),
    architecture: p['架构类型']?.select?.name || null,
    predictionParadigm: p['预测范式']?.select?.name || null,
    quadrant: p['四象限']?.select?.name || null,
    classificationStatus: p['分类状态']?.select?.name || null,
  };
}

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validatePapers(papers, { allowEmpty = false } = {}) {
  if (!Array.isArray(papers)) throw new Error('papers.json must contain an array');
  if (!papers.length && !allowEmpty) throw new Error('Refusing an empty paper catalog. Review the source and use --allow-empty only for an intentional reset.');
  const ids = new Set();
  const urls = new Set();
  papers.forEach((paper, index) => {
    const label = `Paper ${index + 1}${paper?.id ? ` (${paper.id})` : ''}`;
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) throw new Error(`${label} must be an object`);
    if (Object.keys(paper).length !== PUBLIC_FIELDS.length || PUBLIC_FIELDS.some((key) => !Object.hasOwn(paper, key))) {
      throw new Error(`${label} must contain exactly the ${PUBLIC_FIELDS.length} catalog fields`);
    }
    for (const field of ['id', 'title', 'authors', 'affiliations', 'contribution', 'abstract', 'bibtexKey', 'bibtex']) {
      if (typeof paper[field] !== 'string') throw new Error(`${label}: ${field} must be a string`);
    }
    for (const field of ['title', 'authors']) {
      if (!paper[field].trim()) throw new Error(`${label}: ${field} cannot be empty`);
    }
    const canonical = paperIdentity(paper.paperUrl);
    if (canonical.id !== paper.id || canonical.arxivUrl !== paper.arxivUrl || canonical.paperUrl !== paper.paperUrl) throw new Error(`${label}: paper ID and canonical URLs disagree`);
    if (ids.has(paper.id) || urls.has(paper.paperUrl)) throw new Error(`${label}: duplicate paper ID or URL`);
    ids.add(paper.id); urls.add(paper.paperUrl);
    if (paper.submittedDate !== null && !isDate(paper.submittedDate)) throw new Error(`${label}: submittedDate must be a real YYYY-MM-DD date or null`);
    if (!CATEGORIES.includes(paper.primaryCategory) && paper.primaryCategory !== UNCATEGORIZED) throw new Error(`${label}: unknown primary category ${paper.primaryCategory}`);
    if (!Array.isArray(paper.secondaryCategories) || paper.secondaryCategories.some((category) => !CATEGORIES.includes(category))) throw new Error(`${label}: unknown secondary category`);
    if (new Set(paper.secondaryCategories).size !== paper.secondaryCategories.length) throw new Error(`${label}: duplicate secondary category`);
    if (!Array.isArray(paper.codeUrls)) throw new Error(`${label}: codeUrls must be an array`);
    paper.codeUrls.forEach((url) => safeUrl(url, `${label} code URL`));
    if (new Set(paper.codeUrls).size !== paper.codeUrls.length) throw new Error(`${label}: duplicate code URL`);
    if (paper.projectUrl !== null) safeUrl(paper.projectUrl, `${label} project URL`);
    if (paper.pdfUrl !== null) safeUrl(paper.pdfUrl, `${label} PDF URL`);
    if (paper.doi !== null && (typeof paper.doi !== 'string' || !paper.doi || normalizeDoi(paper.doi) !== paper.doi)) throw new Error(`${label}: doi must be a canonical https://doi.org/ URL or null`);
    if (paper.publicationYear !== null && (!Number.isInteger(paper.publicationYear) || paper.publicationYear < 1000 || paper.publicationYear > new Date().getUTCFullYear() + 1)) throw new Error(`${label}: publicationYear must be an integer from 1000 through next year, or null`);
    if (paper.venue !== null && (typeof paper.venue !== 'string' || !paper.venue.trim())) throw new Error(`${label}: venue must be a nonempty string or null`);
    for (const [field, options] of [
      ['majorCategory', MAJOR_CATEGORIES], ['architecture', ARCHITECTURES],
      ['predictionParadigm', PREDICTION_PARADIGMS], ['quadrant', QUADRANT_STATUSES],
      ['classificationStatus', CLASSIFICATION_STATUSES],
    ]) {
      if (paper[field] !== null && !options.includes(paper[field])) throw new Error(`${label}: unknown ${field}`);
    }
    if (!Array.isArray(paper.subcategories) || paper.subcategories.some((value) => typeof value !== 'string' || !value.trim())) throw new Error(`${label}: subcategories must contain nonempty strings`);
    if (new Set(paper.subcategories).size !== paper.subcategories.length) throw new Error(`${label}: duplicate subcategory`);
    const axes = QUADRANT_AXES[paper.quadrant];
    if (axes && (paper.architecture !== axes.architecture || paper.predictionParadigm !== axes.predictionParadigm)) throw new Error(`${label}: quadrant does not agree with architecture and predictionParadigm`);
  });
  return papers;
}

export function sortPapers(papers) {
  const key = (paper) => paper.submittedDate ?? (paper.publicationYear === null || paper.publicationYear === undefined ? '' : String(paper.publicationYear));
  return [...papers].sort((a, b) => key(b).localeCompare(key(a)) || a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id));
}

export const CATALOG_SOURCES = Object.freeze(['Notion', 'Notion + arXiv discovery']);

// These explicit editorial decisions affect only category placement. Source
// verification status, quadrant axes, bibliography and reading snapshots stay intact.
export function validateClassificationOverrides(manifest) {
  const exact = (value, fields) => value && !Array.isArray(value) && typeof value === 'object'
    && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
  if (!exact(manifest, ['schemaVersion', 'reviewedAt', 'entries']) || manifest.schemaVersion !== 1) throw new Error('Classification overrides must contain exactly the version 1 manifest fields');
  if (typeof manifest.reviewedAt !== 'string' || Number.isNaN(Date.parse(manifest.reviewedAt)) || new Date(manifest.reviewedAt).toISOString() !== manifest.reviewedAt) throw new Error('Classification overrides reviewedAt must be an ISO UTC timestamp');
  if (!Array.isArray(manifest.entries)) throw new Error('Classification override entries must be an array');
  const ids = new Set();
  for (const entry of manifest.entries) {
    if (!exact(entry, ['paperId', 'componentArea', 'reason', 'evidenceIds', 'reportSha256'])) throw new Error('Classification override must contain exactly the public review fields');
    if (typeof entry.paperId !== 'string' || !/^(?:\d{4}\.\d{4,5}|ref-[a-f0-9]{20})$/.test(entry.paperId)) throw new Error('Classification override has an invalid paperId');
    if (ids.has(entry.paperId)) throw new Error(`Duplicate classification override: ${entry.paperId}`);
    ids.add(entry.paperId);
    if (!COMPONENT_AREAS.includes(entry.componentArea)) throw new Error(`Unknown componentArea for ${entry.paperId}`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new Error(`Missing classification reason for ${entry.paperId}`);
    if (!Array.isArray(entry.evidenceIds) || !entry.evidenceIds.length || entry.evidenceIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(entry.evidenceIds).size !== entry.evidenceIds.length) throw new Error(`Invalid classification evidenceIds for ${entry.paperId}`);
    if (typeof entry.reportSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.reportSha256)) throw new Error(`Invalid reportSha256 for ${entry.paperId}`);
  }
  return manifest;
}

export function applyClassificationOverrides(papers, manifest) {
  validatePapers(papers, { allowEmpty: true });
  validateClassificationOverrides(manifest);
  const reviews = new Map(manifest.entries.map(entry => [entry.paperId, entry]));
  // A review cannot resurrect a paper deleted from both catalog sources.
  return papers.map(paper => {
    const review = reviews.get(paper.id);
    if (!review) return paper;
    return { ...paper, majorCategory: 'WAM Components', subcategories: [componentSubcategory(review.componentArea),
      ...paper.subcategories.filter(value => !COMPONENT_AREAS.includes(value) && taxonomyLabel(value) !== review.componentArea)] };
  });
}

// Local discoveries persist across exports; an editor's current Notion record
// takes precedence as a whole, including intentionally empty classifications.
export function mergeCatalogPapers(notionPapers, localPapers = []) {
  validatePapers(notionPapers, { allowEmpty: true });
  validatePapers(localPapers, { allowEmpty: true });
  const notionIds = new Set(notionPapers.map(paper => paper.id));
  const localOnly = localPapers.filter(paper => !notionIds.has(paper.id));
  const papers = sortPapers([...notionPapers, ...localOnly]);
  validatePapers(papers, { allowEmpty: true });
  return { papers, source: localOnly.length ? CATALOG_SOURCES[1] : CATALOG_SOURCES[0] };
}

export function buildMeta(papers, updatedAt = new Date().toISOString(), source = 'Notion') {
  if (!CATALOG_SOURCES.includes(source)) throw new Error('Unknown catalog metadata source');
  const dates = papers.map((paper) => paper.submittedDate).filter((date) => date !== null).sort();
  return { updatedAt, source, paperCount: papers.length, sourceDateRange: { start: dates[0] ?? null, end: dates.at(-1) ?? null } };
}

export function validateMeta(meta, papers) {
  const expected = buildMeta(papers, meta?.updatedAt, meta?.source);
  if (!meta || Object.keys(meta).sort().join() !== Object.keys(expected).sort().join()) throw new Error('meta.json must contain exactly the catalog metadata fields');
  if (typeof meta.updatedAt !== 'string' || Number.isNaN(Date.parse(meta.updatedAt)) || new Date(meta.updatedAt).toISOString() !== meta.updatedAt) throw new Error('Metadata updatedAt must be an ISO UTC timestamp');
  if (JSON.stringify(meta.sourceDateRange) !== JSON.stringify(expected.sourceDateRange) || meta.paperCount !== expected.paperCount || meta.source !== expected.source) throw new Error('Metadata does not match papers.json');
  return meta;
}

export function planCatalogUpdate(papers, previous, previousMeta, fetchedAt, source = 'Notion') {
  if (!CATALOG_SOURCES.includes(source)) throw new Error('Unknown catalog metadata source');
  if (isDeepStrictEqual(sortPapers(papers), sortPapers(previous))) {
    try {
      validateMeta(previousMeta, papers);
      if (previousMeta.source === source) return { changed: false, meta: previousMeta };
    } catch { /* Missing or invalid metadata must be repaired even when papers are unchanged. */ }
  }
  const meta = buildMeta(papers, fetchedAt, source);
  validateMeta(meta, papers);
  return { changed: true, meta };
}

// Only the exact former 14- and 19-field schemas are migratable. Unknown/private fields are
// rejected instead of being silently discarded while reading a previous catalog.
export function migrateLegacyCatalog(papers) {
  if (!Array.isArray(papers)) throw new Error('Previous catalog must contain an array');
  const migrated = papers.map((paper) => {
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) return paper;
    const matches = (fields) => Object.keys(paper).length === fields.length && fields.every((key) => Object.hasOwn(paper, key));
    if (matches(LEGACY_PUBLIC_FIELDS)) paper = { ...paper, paperUrl: paper.arxivUrl, pdfUrl: null, doi: null, publicationYear: null, bibtex: '' };
    if (matches(REFERENCE_PUBLIC_FIELDS)) paper = { ...paper, majorCategory: null, subcategories: [], architecture: null, predictionParadigm: null, quadrant: null, classificationStatus: null };
    return paper;
  });
  return validatePapers(migrated, { allowEmpty: true });
}

export function guardDecrease(previousCount, nextCount, { allowLargeDecrease = false, allowEmpty = false } = {}) {
  if (!nextCount && !allowEmpty) throw new Error('Refusing an empty export. Check the source; an intentional reset requires --allow-empty.');
  if (previousCount > 0 && nextCount < previousCount * 0.8 && !allowLargeDecrease) throw new Error(`Refusing a decrease from ${previousCount} to ${nextCount} papers (over 20%). Review the source and rerun with --allow-large-decrease if intentional.`);
}

export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

// Stage every file first, then replace each destination atomically. Roll back on a failed rename.
export async function atomicWriteFiles(files) {
  const staged = [];
  try {
    for (const [path, contents] of files) {
      await mkdir(dirname(path), { recursive: true });
      let previous = null;
      try { previous = await readFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, contents, { flag: 'wx' });
      staged.push({ path, temp, previous, replaced: false });
    }
    for (const item of staged) { await rename(item.temp, item.path); item.replaced = true; }
  } catch (error) {
    for (const item of staged.filter((entry) => entry.replaced).reverse()) {
      if (item.previous === null) await unlink(item.path);
      else { await writeFile(item.temp, item.previous); await rename(item.temp, item.path); }
    }
    throw error;
  } finally {
    await Promise.all(staged.map((item) => unlink(item.temp).catch((error) => { if (error.code !== 'ENOENT') throw error; })));
  }
}

export function coverage(papers) {
  return {
    papers: papers.length,
    arxiv: papers.filter((p) => p.arxivUrl).length,
    nonArxiv: papers.filter((p) => !p.arxivUrl).length,
    code: papers.filter((p) => p.codeUrls.length).length,
    project: papers.filter((p) => p.projectUrl).length,
    venue: papers.filter((p) => p.venue).length,
    pdf: papers.filter((p) => p.pdfUrl).length,
    doi: papers.filter((p) => p.doi).length,
    publicationYear: papers.filter((p) => p.publicationYear !== null).length,
    bibtex: papers.filter((p) => p.bibtex).length,
    unknownDate: papers.filter((p) => p.submittedDate === null).length,
    missingAbstract: papers.filter((p) => !p.abstract.trim()).length,
    uncategorized: papers.filter((p) => p.primaryCategory === UNCATEGORIZED).length,
    majorCategory: papers.filter((p) => p.majorCategory !== null).length,
    subcategories: papers.filter((p) => p.subcategories.length).length,
    architecture: papers.filter((p) => p.architecture !== null).length,
    predictionParadigm: papers.filter((p) => p.predictionParadigm !== null).length,
    quadrant: papers.filter((p) => p.quadrant !== null).length,
    classificationStatus: papers.filter((p) => p.classificationStatus !== null).length,
    quadrantDistribution: Object.fromEntries(QUADRANT_STATUSES.map((quadrant) => [quadrant, papers.filter((p) => p.quadrant === quadrant).length])),
  };
}
