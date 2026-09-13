/** Pure catalog filtering shared by the browser and its behavioral tests. */
import { taxonomyLabel } from './taxonomy.mjs';
import { venueLabel } from './display.mjs';

export function normalize(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

// Names vary between Fast-WAM, Fast WAM and FastWAM. Also discard invisible
// formatting characters from copied PDF text, while retaining symbols like +.
function compact(text) {
  return normalize(text ?? '').replace(/[\s\p{Pd}\p{Pc}\p{Cf}]/gu, '');
}

export function defaultSort(filters = {}) {
  return String(filters.query || '').trim() || filters.major === '奠基性工作' ? 'relevance' : 'oldest';
}

// Reading order by the reviewed primary subcategory's relationship to WAMs.
// This is an editorial scope order, not a citation or popularity score.
const foundationOrder = new Map([
  ['经典WM与模型式RL', 0], ['潜动作预训练', 0], ['潜空间预测与JEPA', 0],
  ['动作策略基础', 1],
  ['理论与规划', 2], ['三维表示与状态估计', 2],
  ['扩散与流匹配基础', 3], ['训练优化与蒸馏', 4],
]);
const foundationRank = paper => foundationOrder.get(paper.subcategories?.[0]) ?? 5;

// A recorded year is enough to order a paper, but is never turned into a date.
// Within a year, dated records precede year-only records. Missing dates and years
// stay last in both chronological directions.
export function comparePapers(a, b, sort = 'newest') {
  if (sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const yearOf = paper => paper.submittedDate ? Number(paper.submittedDate.slice(0, 4)) : paper.publicationYear ?? null;
  const aYear = yearOf(a);
  const bYear = yearOf(b);
  if (aYear === null && bYear !== null) return 1;
  if (bYear === null && aYear !== null) return -1;
  if (aYear === null && bYear === null) return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const direction = sort === 'oldest' ? 1 : -1;
  if (aYear !== bYear) return (aYear - bYear) * direction;
  if (a.submittedDate && !b.submittedDate) return -1;
  if (!a.submittedDate && b.submittedDate) return 1;
  return ((a.submittedDate || '').localeCompare(b.submittedDate || '') || a.id.localeCompare(b.id)) * direction;
}

export function filterPapers(papers, filters) {
  const sort = filters.sort || defaultSort(filters);
  const words = normalize(filters.query || '').split(/\s+/).map(compact).filter(Boolean);
  const result = papers.filter(paper => {
    if (filters.major && (filters.major === '__unassigned__' ? Boolean(paper.majorCategory) : paper.majorCategory !== filters.major)) return false;
    if (filters.quadrant && (filters.quadrant === '__unassigned__' ? Boolean(paper.quadrant) : paper.quadrant !== filters.quadrant)) return false;
    if (filters.subtype && (filters.subtype === '__unassigned__' ? Boolean(paper.subcategories?.length) : !paper.subcategories?.includes(filters.subtype))) return false;
    if (filters.category && paper.primaryCategory !== filters.category) return false;
    if (filters.secondary && !paper.secondaryCategories.includes(filters.secondary)) return false;
    if (filters.month && !paper.submittedDate?.startsWith(filters.month)) return false;
    if (filters.year && String(paper.publicationYear ?? '') !== String(filters.year)) return false;
    if (filters.code && !paper.codeUrls.length) return false;
    const taxonomy = [paper.majorCategory, ...(paper.subcategories || []), paper.architecture, paper.predictionParadigm, paper.quadrant, paper.classificationStatus].filter(Boolean);
    const topics = [paper.primaryCategory, ...paper.secondaryCategories];
    // Keep field boundaries: a compact name must not be invented by joining a
    // title's ending to an author's name. Separate keywords may match any field.
    const searchable = [paper.title, paper.authors, paper.affiliations, paper.contribution, paper.abstract, paper.id, paper.bibtexKey, paper.bibtex, paper.paperUrl, paper.arxivUrl, paper.pdfUrl, paper.doi, paper.publicationYear, paper.venue, paper.venue ? venueLabel(paper.venue) : '', ...taxonomy, ...taxonomy.map(taxonomyLabel), ...topics, ...topics.map(taxonomyLabel)].map(compact).join('\0');
    return words.every(word => searchable.includes(word));
  });
  // A name search should surface the paper itself before newer papers that
  // mention it in their abstracts. Explicit chronological sorts still apply.
  const relevance = words.length > 0 && sort === 'relevance';
  const foundationRelevance = sort === 'relevance' && filters.major === '奠基性工作';
  const queryKey = words.join('');
  const score = paper => {
    if ([paper.id, paper.bibtexKey].some(value => compact(value) === queryKey)) return 2;
    const title = compact(paper.title);
    return words.every(word => title.includes(word)) ? 1 : 0;
  };
  return result.sort((a, b) => (relevance ? score(b) - score(a) : 0)
    || (foundationRelevance ? foundationRank(a) - foundationRank(b) : 0)
    || comparePapers(a, b, sort === 'relevance' ? 'oldest' : sort));
}
