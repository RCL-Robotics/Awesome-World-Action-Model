/** Pure catalog filtering shared by the browser and its behavioral tests. */
export function normalize(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function filterPapers(papers, filters) {
  const words = normalize(filters.query || '').trim().split(/\s+/).filter(Boolean);
  const result = papers.filter(paper => {
    if (filters.category && paper.primaryCategory !== filters.category) return false;
    if (filters.secondary && !paper.secondaryCategories.includes(filters.secondary)) return false;
    if (filters.month && !paper.submittedDate.startsWith(filters.month)) return false;
    if (filters.code && !paper.codeUrls.length) return false;
    const searchable = normalize([paper.title, paper.authors, paper.affiliations, paper.contribution, paper.abstract, paper.id, paper.bibtexKey, paper.primaryCategory, ...paper.secondaryCategories].join(' '));
    return words.every(word => searchable.includes(word));
  });
  return result.sort((a, b) => {
    if (filters.sort === 'title') return a.title.localeCompare(b.title);
    const order = a.submittedDate.localeCompare(b.submittedDate) || a.id.localeCompare(b.id);
    return filters.sort === 'oldest' ? order : -order;
  });
}
