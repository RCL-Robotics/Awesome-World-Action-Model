// Server/build-time helper shared by the report runner and Astro frontmatter.
// Do not import this module from a browser script.
import { createHash } from 'node:crypto';
import { taxonomyLabel } from './taxonomy.mjs';

export function classificationSnapshot(paper, catalogUpdatedAt) {
  const fields = ['majorCategory', 'subcategories', 'architecture', 'predictionParadigm', 'quadrant', 'classificationStatus'];
  const recorded = Object.fromEntries(fields.map(field => [field, paper[field]]));
  return {
    ...Object.fromEntries(fields.map(field => [field, field === 'subcategories' ? paper[field].map(taxonomyLabel) : taxonomyLabel(paper[field])])),
    catalogUpdatedAt,
    fingerprint: createHash('sha256').update(JSON.stringify(recorded)).digest('hex'),
  };
}
