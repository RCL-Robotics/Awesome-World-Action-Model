import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PYTHON, sha, snapshotSource } from '../scripts/lib/illustrated-runner.mjs';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));

async function snapshot(t, text) {
  const root = await mkdtemp(join(tmpdir(), 'wam-source-newlines-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sources = join(root, 'sources');
  await mkdir(sources);
  const sourcePath = join(sources, 'original.txt');
  await writeFile(sourcePath, text);
  const manifest = { kind: 'text', sourcePath, textPath: sourcePath, sha256: sha(Buffer.from(text)), textSha256: sha(Buffer.from(text)) };
  const attempt = join(root, 'attempt');
  const config = await snapshotSource({ attempt, manifest, repository });
  const readChunk = index => execute(DEFAULT_PYTHON, [join(attempt, 'source-tool.py'), '--root', attempt, 'read', String(index)]);
  return { attempt, config, readChunk };
}

for (const [name, text] of [
  ['CRLF line endings', 'Page 1\r\nMethods\r\nObserved result: 70.5.\r\n'],
  ['lone carriage returns', 'Equation\rx = 1\ry = 2\rPage 2\nResults\r'],
  ['Unicode across chunk boundaries', 'a'.repeat(11999) + '🧪 π − ∞ 中文\r\nβ → γ\r']
]) {
  test(`source reader preserves ${name} and their original hashes`, async t => {
    const { attempt, config, readChunk } = await snapshot(t, text);
    let reconstructed = '';
    for (const [index, chunk] of config.chunks.entries()) {
      const expected = await readFile(join(attempt, chunk.path), 'utf8');
      const { stdout } = await readChunk(index + 1);
      assert.equal(stdout, `SOURCE CHUNK ${index + 1}/${config.chunks.length} — retain existing page/section labels\n${expected}\n`);
      reconstructed += expected;
    }
    assert.equal(reconstructed, text);
    const audit = (await readFile(join(attempt, 'source-audit.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(audit, config.chunks.map((chunk, index) => ({ operation: 'read', chunk: index + 1, sha256: chunk.sha256 })));
  });
}

test('source reader rejects changed chunk bytes without recording a completed read', async t => {
  const { attempt, config, readChunk } = await snapshot(t, 'Verified source\r\nMethods\rResults π');
  await writeFile(join(attempt, config.chunks[0].path), 'Verified source\nMethods\rResults π');
  await assert.rejects(readChunk(1), error => error.code === 1 && /Text chunk changed/.test(error.stderr));
  await assert.rejects(readFile(join(attempt, 'source-audit.jsonl')), { code: 'ENOENT' });
});
