export const SORTS = ['oldest', 'newest', 'relevance', 'title'];
const slug = /^[a-z0-9][a-z0-9._-]*$/;
const fail = message => { throw new Error(message); };
const text = value => typeof value === 'string';
const stringList = value => Array.isArray(value) && value.every(item => text(item) && item.trim()) && new Set(value).size === value.length;
const only = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.includes(key));
export function safeUrl(value) {
  if (!text(value) || /[\s<>"`]/u.test(value)) return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function validateConfig(c) {
  if (!only(c, ['schemaVersion', 'mode', 'title', 'description', 'language', 'authors', 'repository', 'site', 'categories', 'sections', 'figures', 'paperUrl', 'citation', 'starHistory', 'exampleData'])) fail('Configuration contains unsupported fields.');
  if (!c || c.schemaVersion !== 1 || !['repo', 'site', 'both'].includes(c.mode)) fail('Expected schemaVersion 1 and mode repo, site or both.');
  if (!text(c.title) || !c.title.trim() || !text(c.description) || !['en', 'zh'].includes(c.language)) fail('Provide title, description and language en or zh.');
  if (!Array.isArray(c.authors) || c.authors.some(a => !only(a, ['name', 'affiliation', 'url']) || !text(a.name) || !a.name.trim() || (a.affiliation != null && !text(a.affiliation)) || (a.url != null && !safeUrl(a.url)))) fail('Invalid authors.');
  if (c.repository !== null && (!only(c.repository, ['owner', 'name']) || !text(c.repository.owner) || !text(c.repository.name) || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(c.repository.owner) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(c.repository.name))) fail('Repository must be null or valid owner/name.');
  if (!only(c.site, ['origin', 'base', 'accent']) || !safeUrl(c.site.origin) || new URL(c.site.origin).protocol !== 'https:' || new URL(c.site.origin).origin !== c.site.origin) fail('site.origin must be an HTTPS origin without a path or trailing slash.');
  if (!/^\/(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*$/.test(c.site.base)) fail('site.base must be / or slash-delimited path segments, for example /my-survey/.');
  if (!/^#[0-9a-fA-F]{6}$/.test(c.site.accent)) fail('site.accent must be a six-digit hex color.');
  if (!Array.isArray(c.categories) || c.categories.some(x => !only(x, ['id', 'label', 'description', 'sort']) || !text(x.id) || !slug.test(x.id) || !text(x.label) || !x.label.trim() || !text(x.description) || !SORTS.includes(x.sort)) || new Set(c.categories.map(x => x.id)).size !== c.categories.length) fail('Categories require unique slug IDs, labels, descriptions and valid sort modes.');
  if (!Array.isArray(c.sections) || c.sections.some(x => !only(x, ['heading', 'text', 'equation']) || !text(x.heading) || !text(x.text) || (x.equation != null && !text(x.equation)))) fail('Invalid introduction sections.');
  if (!Array.isArray(c.figures) || c.figures.some(x => !only(x, ['src', 'alt', 'caption']) || !/^\/assets\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|svg|gif)$/.test(x.src) || !text(x.alt) || !x.alt.trim() || !text(x.caption))) fail('Figures need a public /assets/ image path, alt and caption.');
  if (c.paperUrl !== null && !safeUrl(c.paperUrl)) fail('Invalid survey paper URL.');
  if (!text(c.citation) || typeof c.starHistory !== 'boolean' || typeof c.exampleData !== 'boolean') fail('Provide citation text and starHistory/exampleData booleans.');
  return c;
}
export function canonicalSource(value) {
  const u = new URL(value);
  if (/(^|\.)arxiv\.org$/.test(u.hostname)) {
    const id = u.pathname.match(/^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?\/?$/i);
    if (id) return `arxiv:${id[1].toLowerCase()}`;
  }
  if (['doi.org', 'dx.doi.org'].includes(u.hostname.toLowerCase())) return `doi:${decodeURIComponent(u.pathname.slice(1)).toLowerCase()}`;
  u.hash = '';
  return u.href;
}
export function validatePapers(papers, config) {
  if (!Array.isArray(papers)) fail('Paper data must be an array.');
  const ids = new Set(), sources = new Set(), categories = new Set(config.categories.map(c => c.id));
  for (const p of papers) {
    if (p && Object.keys(p).some(key => !['id', 'title', 'authors', 'url', 'year', 'date', 'categories', 'tags', 'abstract', 'summary', 'bibtex', 'codeUrl', 'projectUrl', 'priority'].includes(key))) fail('Paper records contain unsupported fields; use only the public catalog contract.');
    if (!p || !text(p.id) || !slug.test(p.id) || ids.has(p.id)) fail(`Invalid or duplicate paper ID: ${p?.id}`);
    if (!text(p.title) || !p.title.trim() || !stringList(p.authors) || !safeUrl(p.url)) fail(`Invalid identity fields: ${p.id}`);
    if (p.year !== null && (!Number.isInteger(p.year) || p.year < 1000 || p.year > 9999)) fail(`Invalid year: ${p.id}`);
    if (p.date !== null && (!text(p.date) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date)) || new Date(p.date).toISOString().slice(0, 10) !== p.date)) fail(`Invalid date: ${p.id}`);
    if (!stringList(p.categories) || p.categories.some(c => !categories.has(c)) || !stringList(p.tags)) fail(`Unknown category or invalid tags: ${p.id}`);
    if (['abstract', 'summary', 'bibtex'].some(f => !text(p[f])) || ['codeUrl', 'projectUrl'].some(f => p[f] !== null && !safeUrl(p[f]))) fail(`Invalid text or resource links: ${p.id}`);
    if (p.priority != null && (!Number.isInteger(p.priority) || p.priority < 0)) fail(`Invalid editorial priority: ${p.id}`);
    const source = canonicalSource(p.url);
    if (sources.has(source)) fail(`Duplicate source for ${p.id}: ${source}`);
    ids.add(p.id); sources.add(source);
  }
  return papers;
}
export const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export const compact = value => normalize(value).replace(/[\s\p{Pd}\p{Pc}\p{Cf}]/gu, '');
export const pathFor = (config, path = '') => config.site.base + path.replace(/^\//, '');
export const repositoryUrl = config => config.repository ? `https://github.com/${config.repository.owner}/${config.repository.name}` : null;
export const websiteUrl = config => config.site.origin === 'https://example.org' ? null : config.site.origin + config.site.base;
export const dateLabel = paper => paper.date || (paper.year === null ? '—' : String(paper.year));
export function chronological(a, b, sort = 'oldest') {
  const year = p => p.date ? Number(p.date.slice(0, 4)) : p.year;
  const ay = year(a), by = year(b);
  if (ay === null || by === null) return ay === by ? a.id.localeCompare(b.id) : ay === null ? 1 : -1;
  const direction = sort === 'newest' ? -1 : 1;
  return (ay - by) * direction || (a.date && !b.date ? -1 : b.date && !a.date ? 1 : 0)
    || (a.date || '').localeCompare(b.date || '') * direction || a.id.localeCompare(b.id);
}
export function defaultSort(config, category, query) { return String(query || '').trim() ? 'relevance' : config.categories.find(c => c.id === category)?.sort || 'oldest'; }
export function filterPapers(papers, config, { query = '', category = '', sort = '', year = '', code = false } = {}) {
  const words = normalize(query).split(/\s+/).map(compact).filter(Boolean);
  const matches = papers.filter(p => (!category || (category === '__unassigned__' ? !p.categories.length : p.categories.includes(category)))
    && (!year || String(p.year) === year) && (!code || p.codeUrl)
    && words.every(word => [p.title, p.authors.join(' '), p.abstract, p.summary, p.id, p.url, p.bibtex, ...p.tags].some(field => compact(field).includes(word))));
  const mode = sort || defaultSort(config, category, query);
  const score = p => words.length && words.every(w => compact(p.title).includes(w)) ? 1 : 0;
  return matches.sort((a, b) => mode === 'title' ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    : (mode === 'relevance' ? score(b) - score(a) || (a.priority ?? 1000000) - (b.priority ?? 1000000) : 0)
    || chronological(a, b, mode));
}
export const labels = language => language === 'zh' ? {
  sort: '排序', development: '本地开发', maintenance: '项目配置与维护', date: '发表日期', home: '首页', papers: '论文库', categories: '分类', all: '全部论文', unassigned: '待分类', search: '搜索标题、作者、摘要或标识符', clear: '清除筛选', oldest: '从旧到新', newest: '从新到旧', relevance: '相关性', title: '按标题', paper: '论文', code: '代码', project: '项目', citation: '引用', missingCitation: '引用信息尚未提供。', empty: '当前筛选下没有匹配论文', allSearch: '保留关键词，搜索全库', abstract: '摘要', summary: '阅读摘要', demo: '演示项目：文献为虚构示例，请替换为核实后的记录。', library: '浏览文献', previous: '上一页', next: '下一页', year: '发表年份', allYears: '全部年份', withCode: '有代码', scope: '当前分类', globalMatches: '全库匹配', count: '篇文献', introduction: '研究概览', star: 'Star History'
} : {
  sort: 'Sort papers', development: 'Development', maintenance: 'Project configuration and maintenance', date: 'Publication date', home: 'Home', papers: 'Paper library', categories: 'Categories', all: 'All papers', unassigned: 'Unassigned', search: 'Search titles, authors, abstracts or identifiers', clear: 'Clear filters', oldest: 'Oldest first', newest: 'Newest first', relevance: 'Relevance', title: 'Title A–Z', paper: 'Paper', code: 'Code', project: 'Project', citation: 'Citation', missingCitation: 'Citation details have not been provided.', empty: 'No papers match these filters', allSearch: 'Search all papers, keeping this query', abstract: 'Abstract', summary: 'Reading summary', demo: 'Demo project: papers are fictional examples. Replace them with verified records.', library: 'Explore the literature', previous: 'Previous', next: 'Next', year: 'Publication year', allYears: 'All years', withCode: 'With code', scope: 'Current category', globalMatches: 'Matches in the full library', count: 'papers', introduction: 'Research overview', star: 'Star History'
};
