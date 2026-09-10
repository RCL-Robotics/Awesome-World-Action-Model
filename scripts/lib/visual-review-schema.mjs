import {validateSelectedReviewContext} from './selected-html-source.mjs';
import {validateFullMp4Context} from './mp4-contract.mjs';
import {validateIdentitySupportContext} from './identity-support.mjs';
import {validateOpenSceneReviewContext} from './openscene-original-evidence.mjs';
import { validateMediaReviewContext } from './html-original-media.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSourceDetailContext } from './source-details.mjs';

// Enumeration prevents invented identity strings;
// validateVisualReview must still check pairs, inventory and scientific verdicts.
export function visualReviewSchemaForContext(context, template) {
  const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (!context || !nonempty(context.paperId) || !hash(context.sourceSha256) || !Array.isArray(context.images) || !context.images.length) {
    throw new Error('A fixed context with paper identity, source SHA256 and images is required');
  }
  const mp4Context=validateFullMp4Context(context);
  validateIdentitySupportContext(context);
  validateMediaReviewContext(context);
  const nativeContext=validateOpenSceneReviewContext(context);
  const selectedContext=validateSelectedReviewContext(context);
  const ids = new Set();
  const hashes = new Set();
  for (const image of context.images) {
    if (!image || !nonempty(image.imageId) || !hash(image.sha256) || ids.has(image.imageId)) {
      throw new Error('Context images require unique nonempty IDs and valid SHA256 strings');
    }
    ids.add(image.imageId);
    hashes.add(image.sha256);
  }
  validateSourceDetailContext(context);
  const schema = structuredClone(template);
  if (schema?.type !== 'object' || schema.properties?.images?.type !== 'array' || schema.properties.images.items?.type !== 'object') {
    throw new Error('Unexpected visual-review template shape');
  }
  const fields = [
    [schema.properties.paperId, [context.paperId]],
    [schema.properties.sourceSha256, [context.sourceSha256]],
    [schema.properties.images.items.properties?.imageId, [...ids]],
    [schema.properties.images.items.properties?.sha256, [...hashes]],
  ];
  for (const [field, values] of fields) {
    if (field?.type !== 'string' || Object.hasOwn(field, 'enum') || Object.hasOwn(field, 'const')) {
      throw new Error('Expected unconstrained identity string fields in the template');
    }
    field.enum = values;
  }
  if (context.identitySupport || context.sourceDetails || nativeContext || selectedContext || mp4Context || context.policy?.version==='wam-original-html-media-evidence-v1') {
    const item = schema.properties.images.items;
    if (Object.hasOwn(item.properties, 'reviewRole') || !Array.isArray(item.required)) throw new Error('Unexpected role schema');
    item.properties.reviewRole = { type: 'string', enum: [...new Set(context.images.map(image => image.reviewRole))] };
    item.required.push('reviewRole');
  }
  if(mp4Context){if(Object.hasOwn(schema.properties,'sampledScopeAcknowledged'))throw Error('Unexpected MP4 template extension');schema.properties.sampledScopeAcknowledged={type:'boolean'};schema.required.push('sampledScopeAcknowledged');}
  return schema;
}

async function main(args) {
  if (args.length !== 4 || args[0] !== '--context' || args[2] !== '--template') {
    throw new Error('Usage: node scripts/lib/visual-review-schema.mjs --context REVIEW_CONTEXT --template STATIC_SCHEMA (JSON to stdout; no files written)');
  }
  const [context, template] = await Promise.all([args[1], args[3]].map(async file => JSON.parse(await readFile(file, 'utf8'))));
  process.stdout.write(`${JSON.stringify(visualReviewSchemaForContext(context, template), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
