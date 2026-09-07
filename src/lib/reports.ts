import { papers, pathFor, type Paper } from './catalog';

export type ClaimKind = 'source' | 'author-claim' | 'analysis' | 'open-question';
export interface ReportClaim { text: string; kind: ClaimKind; evidenceIds: string[]; }
export interface ReportSource { id: string; url: string; title: string; kind: 'pdf' | 'latex' | 'html' | 'text'; sha256: string; wordCount: number; accessedAt: string; }
export interface ReportEvidence { id: string; sourceId: string; location: string; detail: string; }
export interface RecordedClassification { majorCategory: string; subcategories: string[]; architecture: string; predictionParadigm: string; quadrant: string; classificationStatus: string; catalogUpdatedAt: string; fingerprint: string; }
export interface ReadingReport {
  schemaVersion: 1;
  paperId: string;
  reportStatus: 'full-text-reviewed' | 'partial-text-reviewed' | 'resource-reviewed';
  resourceType: 'paper' | 'survey' | 'book' | 'dataset' | 'metric' | 'benchmark' | 'simulator' | 'technical-resource';
  generatedAt: string;
  sources: ReportSource[];
  coverage: { scope: 'full-paper' | 'selected-sections' | 'abstract-only' | 'resource-overview'; sectionsRead: string[]; omissions: string[]; identityVerified: boolean; figuresReviewed: string[]; tablesReviewed: string[]; appendix: 'reviewed' | 'not-read' | 'not-present' | 'unknown'; };
  synopsis: string;
  readingTimeMinutes: number;
  problem: ReportClaim;
  contributions: ReportClaim[];
  method: { inputs: string[]; outputs: string[]; steps: { name: string; detail: string; evidenceIds: string[] }[]; training: ReportClaim[]; inference: ReportClaim[]; equations: { expression: string; explanation: string; evidenceIds: string[] }[]; };
  results: { task: string; setting: string; metric: string; value: string; comparison: string; interpretation: string; evidenceIds: string[] }[];
  limitations: ReportClaim[];
  reproduction: ReportClaim[];
  taxonomy: { assessment: 'supports' | 'conflicts' | 'unclear' | 'not-applicable'; reasoning: ReportClaim; recordedClassification: RecordedClassification; };
  discussionQuestions: string[];
  relatedPaperIds: string[];
  evidence: ReportEvidence[];
}

export const readingStatuses = ['queued', 'reviewed', 'partial', 'resource', 'unavailable', 'identity-mismatch', 'error'] as const;
export type ReadingStatus = typeof readingStatuses[number];
export const accessStatuses = ['pending', 'full-text', 'partial-text', 'unavailable', 'identity-mismatch'] as const;
export type AccessStatus = typeof accessStatuses[number];
export interface ReadingIndexEntry { paperId: string; accessStatus: AccessStatus; readingStatus: ReadingStatus; sourceUrl: string | null; reason: string; }
interface ReadingIndex { schemaVersion: 1; updatedAt: string; entries: ReadingIndexEntry[]; }
export interface ReadingEntry extends ReadingIndexEntry { paper: Paper; report?: ReadingReport; }

export const readingStatusLabel: Record<ReadingStatus, string> = { queued: 'Queued', reviewed: 'Full-text reviewed', partial: 'Partially reviewed', resource: 'Resource reviewed', unavailable: 'Source unavailable', 'identity-mismatch': 'Identity mismatch', error: 'Needs retry' };
export const accessStatusLabel: Record<AccessStatus, string> = { pending: 'Access pending', 'full-text': 'Full text available', 'partial-text': 'Partial text available', unavailable: 'Source unavailable', 'identity-mismatch': 'Identity mismatch' };
export const claimKindLabel: Record<ClaimKind, string> = { source: 'Source description', 'author-claim': 'Author claim', analysis: 'Reader analysis', 'open-question': 'Open question' };
export const scopeLabel: Record<ReadingReport['coverage']['scope'], string> = { 'full-paper': 'Full paper', 'selected-sections': 'Selected sections', 'abstract-only': 'Abstract only', 'resource-overview': 'Resource overview' };
export const appendixLabel: Record<ReadingReport['coverage']['appendix'], string> = { reviewed: 'Reviewed', 'not-read': 'Not read', 'not-present': 'Not present', unknown: 'Not established' };
export const assessmentLabel: Record<ReadingReport['taxonomy']['assessment'], string> = { supports: 'Supports the recorded classification', conflicts: 'Conflicts with the recorded classification', unclear: 'Insufficient evidence to decide', 'not-applicable': 'Classification assessment not applicable' };
export const reportStatusToReadingStatus = (status: ReadingReport['reportStatus']): ReadingStatus => ({ 'full-text-reviewed': 'reviewed', 'partial-text-reviewed': 'partial', 'resource-reviewed': 'resource' })[status] as ReadingStatus;
export const reportPath = (id: string) => pathFor(`reports/${encodeURIComponent(id)}/`);
export const reportDate = (date: string) => { const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? 'Not recorded' : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
export const sourceHref = (url: string | null | undefined) => { try { const parsed = new URL(url || ''); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; } };
export const reportAnchor = (kind: 'evidence' | 'source', id: string) => `${kind}-${[...id].map(char => char.codePointAt(0)!.toString(16)).join('-')}`;

const papersById = new Map(papers.map(paper => [paper.id, paper]));
const reportModules = import.meta.glob<ReadingReport>('../../data/reports/*.json', { eager: true, import: 'default' });
export const reports = Object.entries(reportModules).map(([filename, report]) => {
  if (report.schemaVersion !== 1 || !papersById.has(report.paperId) || filename.split('/').at(-1) !== `${report.paperId}.json` || !['full-text-reviewed', 'partial-text-reviewed', 'resource-reviewed'].includes(report.reportStatus)) throw new Error(`Invalid reading report identity or status: ${filename}`);
  return report;
});
const reportsById = new Map(reports.map(report => [report.paperId, report]));
export const reportFor = (id: string) => reportsById.get(id);

const indexModules = import.meta.glob<ReadingIndex>('../../data/reading-index.json', { eager: true, import: 'default' });
const readingIndex = Object.values(indexModules)[0];
if (readingIndex && (readingIndex.schemaVersion !== 1 || !Array.isArray(readingIndex.entries))) throw new Error('Invalid reading index schema');
const indexed = new Map<string, ReadingIndexEntry>();
for (const entry of readingIndex?.entries || []) {
  if (!papersById.has(entry.paperId) || indexed.has(entry.paperId) || !readingStatuses.includes(entry.readingStatus) || !accessStatuses.includes(entry.accessStatus)) throw new Error(`Invalid or duplicate reading index entry: ${entry.paperId}`);
  indexed.set(entry.paperId, entry);
}
export const readingIndexUpdatedAt = readingIndex?.updatedAt;
export const readingEntries: ReadingEntry[] = papers.map(paper => {
  const report = reportsById.get(paper.id);
  const entry = indexed.get(paper.id);
  return {
    paperId: paper.id, paper, report,
    readingStatus: report ? reportStatusToReadingStatus(report.reportStatus) : entry?.readingStatus || 'queued',
    accessStatus: entry?.accessStatus || (report ? (report.coverage.identityVerified ? (report.reportStatus === 'full-text-reviewed' ? 'full-text' : report.reportStatus === 'partial-text-reviewed' ? 'partial-text' : 'pending') : 'identity-mismatch') : 'pending'),
    sourceUrl: report?.sources[0]?.url || entry?.sourceUrl || paper.paperUrl,
    reason: entry?.reason || (report ? '' : 'A source-grounded reading report has not been completed yet.'),
  };
});
const entriesById = new Map(readingEntries.map(entry => [entry.paperId, entry]));
export const readingEntryFor = (id: string) => entriesById.get(id);
export const readingCounts = Object.fromEntries(readingStatuses.map(status => [status, readingEntries.filter(entry => entry.readingStatus === status).length])) as Record<ReadingStatus, number>;
