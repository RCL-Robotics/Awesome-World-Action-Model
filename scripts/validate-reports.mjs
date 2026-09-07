#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ROOT, loadReports, readJSON, validateReadingIndex } from './lib/reports.mjs';
import { validateIllustratedCollection } from './lib/illustrated-reports.mjs';
const repository = fileURLToPath(ROOT);
const papers = await readJSON(join(repository, 'data/papers.json'));
const reports = await loadReports(join(repository, 'data/reports'), { paperIds: new Set(papers.map(p => p.id)) });
validateReadingIndex(await readJSON(join(repository, 'data/reading-index.json')), { paperIds: new Set(papers.map(p => p.id)) });
console.log(`Validated ${reports.length} source-grounded reading reports.`);
const illustrated = await validateIllustratedCollection(repository, reports);
console.log(`Validated ${illustrated.length} illustrated pilot reports with ${illustrated.reduce((sum, report) => sum + report.visuals.length, 0)} original figures and tables.`);
