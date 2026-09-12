#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readJson, validatePapers, validateMeta, coverage, applyClassificationOverrides } from './lib/data.mjs';

try {
  const papers = validatePapers(await readJson(fileURLToPath(new URL('../data/papers.json', import.meta.url))));
  validateMeta(await readJson(fileURLToPath(new URL('../data/meta.json', import.meta.url))), papers);
  const reviews = await readJson(fileURLToPath(new URL('../data/classification-overrides.json', import.meta.url)));
  if (!isDeepStrictEqual(papers, applyClassificationOverrides(papers, reviews))) throw new Error('papers.json does not reflect the saved classification overrides; apply the category reviews before building.');
  const stats = coverage(papers);
  console.log(`Valid catalog: ${stats.papers} unique papers (${stats.arxiv} arXiv, ${stats.nonArxiv} other), ${stats.code} with code, ${stats.project} with project pages, ${stats.pdf} with PDFs, ${stats.doi} with DOIs.`);
  console.log(`Missing dates ${stats.unknownDate}, missing abstracts ${stats.missingAbstract}, uncategorized ${stats.uncategorized}; publication years recorded ${stats.publicationYear}.`);
  console.log(`Classification coverage: major ${stats.majorCategory}, subcategories ${stats.subcategories}, architecture ${stats.architecture}, prediction paradigm ${stats.predictionParadigm}, quadrant ${stats.quadrant}, status ${stats.classificationStatus}.`);
  console.log(`Quadrants: ${JSON.stringify(stats.quadrantDistribution)}.`);
} catch (error) { console.error(`Data validation failed: ${error.message}`); process.exitCode = 1; }
