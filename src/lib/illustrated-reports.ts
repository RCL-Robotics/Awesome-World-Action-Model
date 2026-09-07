import pilot from '../../data/report-pilot.json';
import type { ClaimKind } from './reports';

export interface ReportVisual {
  id: string;
  kind: 'figure' | 'table';
  section: 'mechanism' | 'results' | 'ablation';
  sourceLabel: string;
  page: number;
  asset: string;
  width: number;
  height: number;
  sourceSha256: string;
  sourceUrl: string;
  crop: [number, number, number, number];
  alt: string;
  caption: string;
  readingGuide: string;
  takeaway: string;
  caution: string;
  evidenceIds: string[];
}
export interface IllustratedReport {
  schemaVersion: 1;
  paperId: string;
  shortTitle: string;
  thesis: string;
  standfirst: string;
  evidenceIds: string[];
  visuals: ReportVisual[];
  walkthrough: { heading: string; text: string; kind: ClaimKind; evidenceIds: string[] }[];
  reproductionChecks: { title: string; text: string; evidenceIds: string[] }[];
  visualAudit: { inspectedPages: number[]; notes: string };
}
const loaded = import.meta.glob('../../data/illustrated-reports/*.json', { eager: true, import: 'default' }) as Record<string, IllustratedReport>;
export const illustratedReports = pilot.paperIds.flatMap(id => Object.values(loaded).filter(report => report.paperId === id));
export const illustratedFor = (id: string) => illustratedReports.find(report => report.paperId === id);
export const pilotAwaitingReview = pilot.state === 'awaiting-user-review';
export const illustratedSections = [
  { id: 'overview', label: '1. Paper overview' },
  { id: 'motivation', label: '2. Motivation' },
  { id: 'taxonomy', label: '3. Research context' },
  { id: 'formulation', label: '4. Problem formulation' },
  { id: 'mechanism', label: '5. Method in detail' },
  { id: 'results', label: '6. Experiments & results' },
  { id: 'boundaries', label: '7. Analysis & limitations' },
  { id: 'evidence', label: '8. Reproducibility audit' },
];
