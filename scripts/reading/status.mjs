#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { ROOT, readJSON, readingIndexSnapshot } from '../lib/reports.mjs';

const repository = fileURLToPath(ROOT);
const args = process.argv.slice(2);
const position = args.indexOf('--work-dir');
const workDir = resolve(position >= 0 ? args[position + 1] : join(repository, '../reading_work'));
const { entries } = await readingIndexSnapshot({ repository, workDir });
const countBy = field => entries.reduce((counts, entry) => {
  counts[entry[field]] = (counts[entry[field]] || 0) + 1;
  return counts;
}, {});
let batch = null;
try {
  const lock = await readJSON(join(workDir, 'reading.lock'));
  let processState = 'unknown';
  try { process.kill(lock.pid, 0); processState = 'running'; }
  catch (error) { if (error.code === 'ESRCH') processState = 'stopped'; }
  batch = { processState, startedAt: lock.startedAt };
} catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(JSON.stringify({ catalogEntries: entries.length, sourceAccess: countBy('accessStatus'), reading: countBy('readingStatus'), batch }, null, 2));
