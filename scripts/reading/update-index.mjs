#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ROOT, updateReadingIndex } from '../lib/reports.mjs';
const repository = fileURLToPath(ROOT);
const workDir = resolve(process.argv[2] || resolve(repository, '../reading_work'));
const entries = await updateReadingIndex({ repository, workDir });
console.log(JSON.stringify(entries.reduce((s, e) => { s[e.readingStatus] = (s[e.readingStatus] || 0) + 1; return s; }, {})));
