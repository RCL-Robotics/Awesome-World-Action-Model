import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('weekly discovery preserves incremental state, identity and complete pagination', async () => {
  const { stderr } = await promisify(execFile)(process.env.ILLUSTRATED_PYTHON || 'python3', [
    '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'weekly_update_test.py',
  ], { cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 30_000 });
  assert.match(stderr, /\bOK\b/);
});
