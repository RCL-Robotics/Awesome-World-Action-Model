#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { readJson, validatePapers, validateMeta, coverage } from './lib/data.mjs';

try {
  const papers = validatePapers(await readJson(fileURLToPath(new URL('../data/papers.json', import.meta.url))));
  validateMeta(await readJson(fileURLToPath(new URL('../data/meta.json', import.meta.url))), papers);
  const stats = coverage(papers);
  console.log(`Valid public catalog: ${stats.papers} unique papers, ${stats.code} with code, ${stats.project} with project pages, ${stats.venue} with venues.`);
} catch (error) { console.error(`Data validation failed: ${error.message}`); process.exitCode = 1; }
