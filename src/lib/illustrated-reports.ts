import pilot from '../../data/report-pilot.json';
import { papers } from './catalog';
import type { ClaimKind } from './reports';

interface HtmlSourceBase {
  fragmentId: string;
  anchor: string | null;
  parts: { startCharacter: number; endCharacter: number; sha256: string }[];
  descriptorSha256: string;
  wrapperSha256: string;
  rendererSha256: string;
  rendererCodeSha256: string;
}
interface OriginalMediaPin {
  mediaPolicyVersion: 'wam-original-html-media-evidence-v1';
  mediaCodeSha256: string;
  mediaManifestSha256: string;
  mediaId: string;
  originalAssetSha256: string;
}
export type HtmlSourceLocator = HtmlSourceBase & (
  { kind: 'html-original' } |
  { kind: 'html-original-table' | 'html-gif-derived-still';
    policyVersion: 'wam-openscene-original-html-gif-evidence-v1';
    profile: 'openscene-7286074-resource-v2'; documentId: string; sourceId: string; sourceSha256: string;
    sourceBundleSha256: string; recipeSha256: string; openSceneCodeSha256: string; processCodeSha256: string;
    originalAssetUrl?: string; assetSha256?: string; frameIndex?: 0; timeMs?: 0; loopIteration?: 0;
    rgbaSha256?: string; framePngSha256?: string; nativeWidth?: 960; nativeHeight?: 540; authoredHtmlWidth?: '996px'; derivationSha256?: string;
  } |
  OriginalMediaPin & ({ kind: 'html-original-raster' } | {
    kind: 'html-animation-derived-still';
    derivationSha256: string;
    timeTuple: { outerFrame: number; outerFps: number; outerTimeSeconds: number; embeddedGIFFrame: number; embeddedGIFTimeMs: number };
  })
);

export interface ReportVisual {
  id: string;
  kind: 'figure' | 'table';
  section: 'mechanism' | 'results' | 'ablation';
  sourceLabel: string;
  page?: number;
  htmlSource?: HtmlSourceLocator;
  sourceRendering?: string;
  asset: string;
  width: number;
  height: number;
  sourceSha256: string;
  sourceUrl: string;
  crop?: [number, number, number, number];
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
  featuredResultTask?: string;
  visualLimitations?: { text: string; kind: 'source' | 'analysis'; evidenceIds: string[] };
  visuals: ReportVisual[];
  walkthrough: { heading: string; text: string; kind: ClaimKind; evidenceIds: string[] }[];
  reproductionChecks: { title: string; text: string; evidenceIds: string[] }[];
  visualAudit: { inspectedPages?: number[]; inspectedSections?: string[]; htmlEvidence?: Record<string, string[]>; notes: string };
}
const loaded = import.meta.glob('../../data/illustrated-reports/*.json', { eager: true, import: 'default' }) as Record<string, IllustratedReport>;
const byId = new Map(Object.values(loaded).map(report => [report.paperId, report]));
const orderedIds = [...pilot.paperIds, ...papers.map(paper => paper.id).filter(id => !pilot.paperIds.includes(id))];
export const illustratedReports = orderedIds.flatMap(id => {
  const report = byId.get(id);
  return report ? [report] : [];
});
export const illustratedFor = (id: string) => illustratedReports.find(report => report.paperId === id);
export const pilotAwaitingReview = pilot.state === 'awaiting-user-review';
export const pilotReportCount = pilot.paperIds.length;
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
