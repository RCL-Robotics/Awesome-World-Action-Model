import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, validateReadingIndex } from '../scripts/lib/reports.mjs';
const claim = () => ({ text: 'The method predicts future states before selecting an action.', kind: 'source', evidenceIds: ['e1'] });
const fixture = () => ({
  schemaVersion: 1, paperId: 'paper-1', reportStatus: 'full-text-reviewed', resourceType: 'paper', generatedAt: '2026-09-07T00:00:00Z',
  sources: [{ id: 'primary', url: 'https://arxiv.org/pdf/2310.10625', title: 'Example verified title', kind: 'pdf', sha256: 'a'.repeat(64), wordCount: 5000, accessedAt: '2026-09-07T00:00:00Z' }],
  coverage: { scope: 'full-paper', sectionsRead: ['Introduction', 'Method', 'Experiments'], omissions: ['Figures not visually inspected.'], identityVerified: true, figuresReviewed: [], tablesReviewed: ['Table 1'], appendix: 'not-present' },
  synopsis: 'A source-grounded explanation.', readingTimeMinutes: 4, problem: claim(), contributions: [claim()],
  method: { inputs: ['Image'], outputs: ['Action'], steps: [{ name: 'Predict', detail: 'Generate future states.', evidenceIds: ['e1'] }], training: [claim()], inference: [claim()], equations: [] },
  results: [{ task: 'Navigation', setting: 'Held-out trajectories', metric: 'Error', value: '0.2', comparison: '0.3 for the baseline', interpretation: 'Lower predictive error in this setting.', evidenceIds: ['e1'] }],
  limitations: [claim()], reproduction: [claim()], taxonomy: { assessment: 'supports', reasoning: claim(), recordedClassification: { majorCategory: 'WAM', subcategories: [], architecture: 'One Model', predictionParadigm: 'IDM', quadrant: 'Q2', classificationStatus: 'Verified', catalogUpdatedAt: '2026-09-07T00:00:00Z', fingerprint: 'a'.repeat(64) } }, discussionQuestions: ['How does longer-horizon prediction change performance?'], relatedPaperIds: [],
  evidence: [{ id: 'e1', sourceId: 'primary', location: 'Section 3; Table 1, navigation row', detail: 'The source reports the method and its evaluation.' }],
});
const paperIds = new Set(['paper-1']);
test('a valid report retains traceable source and claim provenance', () => { const report = fixture(); assert.equal(validateReport(report, { paperIds }), report); });
test('unresolved evidence and invented sources are rejected', () => {
  const report = fixture(); report.results[0].evidenceIds = ['missing']; assert.throws(() => validateReport(report), /Unresolved evidence/);
  report.results[0].evidenceIds = ['e1']; report.evidence[0].sourceId = 'unread-source'; assert.throws(() => validateReport(report), /unknown source/);
});
test('a partial source cannot be promoted to full-text reviewed', () => {
  const report = fixture(); const primary = report.sources[0];
  const manifest = { paperId: report.paperId, accessStatus: 'partial-text', titleMatch: true, canonicalUrl: primary.url, sha256: primary.sha256, wordCount: primary.wordCount };
  assert.throws(() => validateReport(report, { manifest }), /partial source/);
  report.reportStatus = 'partial-text-reviewed'; report.coverage.scope = 'selected-sections'; assert.equal(validateReport(report, { manifest }), report);
});
test('identity and source fingerprints must agree with the manifest', () => {
  const report = fixture(); const primary = report.sources[0];
  const manifest = { paperId: report.paperId, accessStatus: 'full-text', titleMatch: true, canonicalUrl: primary.url, sha256: 'b'.repeat(64), wordCount: primary.wordCount };
  assert.throws(() => validateReport(report, { manifest }), /provenance differs/);
  report.coverage.identityVerified = false; assert.throws(() => validateReport(report), /identity/);
});
test('substantive claims require evidence while honest open questions may remain unresolved', () => {
  const report = fixture(); report.reproduction[0].evidenceIds = []; assert.throws(() => validateReport(report), /no evidence/);
  report.reproduction[0].kind = 'open-question'; assert.equal(validateReport(report), report);
});
test('unsafe URLs, private fields, and unknown catalog links cannot enter reports', () => {
  let report = fixture(); report.sources[0].url = 'file:///private/source.pdf'; assert.throws(() => validateReport(report), /Unsafe source URL/);
  report = fixture(); report.rawNotionPage = {}; assert.throws(() => validateReport(report), /unexpected field/);
  report = fixture(); report.synopsis = '/Users/researcher/private/document'; assert.throws(() => validateReport(report), /Private data/);
  report = fixture(); report.relatedPaperIds = ['unknown']; assert.throws(() => validateReport(report, { paperIds }), /outside the catalog/);
});
test('the batch reader may cite only the supplied primary source with exact provenance', () => {
  const report = fixture(); const primary = report.sources[0];
  const manifest = { paperId: report.paperId, accessStatus: 'full-text', titleMatch: true, canonicalUrl: primary.url, sha256: primary.sha256, wordCount: primary.wordCount, observedTitle: primary.title, kind: primary.kind, accessedAt: primary.accessedAt };
  report.sources.push({ ...primary, id: 'invented' }); assert.throws(() => validateReport(report, { manifest }), /not supplied/);
  report.sources.pop(); report.sources[0].title = 'Different title'; assert.throws(() => validateReport(report, { manifest }), /provenance differs/);
});
test('text-only and abstract-only reading cannot inflate inspection coverage', () => {
  const report = fixture(); const primary = report.sources[0];
  const manifest = { paperId: report.paperId, accessStatus: 'full-text', titleMatch: true, canonicalUrl: primary.url, sha256: primary.sha256, wordCount: primary.wordCount, readingMode: 'text-only', omissions: ['Appendix unavailable.'] };
  report.coverage.figuresReviewed = ['Figure 1']; assert.throws(() => validateReport(report, { manifest }), /visual figure/);
  report.coverage.figuresReviewed = []; assert.throws(() => validateReport(report, { manifest }), /omissions/);
  report.coverage.omissions.push('Appendix unavailable.'); assert.equal(validateReport(report, { manifest }), report);
  report.reportStatus = 'partial-text-reviewed'; report.coverage.scope = 'abstract-only'; assert.throws(() => validateReport(report), /abstract-only/);
});
test('temporary cache paths do not leak through report prose', () => {
  const report = fixture(); report.synopsis = 'Read from /private/tmp/reading_work/source.txt'; assert.throws(() => validateReport(report), /Private data/);
});
test('the site queue contains only complete catalog statuses and public source metadata', () => {
  const index = { schemaVersion: 1, updatedAt: '2026-09-07T00:00:00Z', entries: [{ paperId: 'paper-1', accessStatus: 'pending', readingStatus: 'queued', sourceUrl: 'https://arxiv.org/abs/2310.10625', reason: 'Source retrieval is queued.' }] };
  assert.equal(validateReadingIndex(index, { paperIds }), index);
  index.entries[0].sourceUrl = 'https://user:secret@example.org/paper'; assert.throws(() => validateReadingIndex(index), /credentials/);
  index.entries[0].sourceUrl = 'https://example.org/Users/researcher/private.pdf'; assert.throws(() => validateReadingIndex(index), /Private data/);
  index.entries[0].sourceUrl = null; index.entries[0].textPath = '/tmp/private.txt'; assert.throws(() => validateReadingIndex(index), /fields/);
  delete index.entries[0].textPath; index.entries[0].accessStatus = 'downloaded'; assert.throws(() => validateReadingIndex(index), /status/);
  index.entries = []; assert.throws(() => validateReadingIndex(index, { paperIds }), /entire catalog/);
});
