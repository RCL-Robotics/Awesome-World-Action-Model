import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const helper = new URL('../scripts/lib/illustrated-runner.mjs', import.meta.url).href;

test('environment runtime overrides persist in source snapshots and retained-context validation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wam-runtime-overrides-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'source.txt'), 'Synthetic source for runtime configuration.');
  const script = `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { join } from 'node:path';
    const { snapshotSource, verifyStoredContext, sha } = await import(process.argv[1]);
    const root = process.argv[2], repository = process.argv[3];
    const sourcePath = join(root, 'source.txt'), bytes = await readFile(sourcePath);
    const manifest = { kind: 'text', sourcePath, textPath: sourcePath, sha256: sha(bytes), textSha256: sha(bytes) };
    const attempt = join(root, 'attempt');
    const config = await snapshotSource({ attempt, manifest, repository });
    const stored = JSON.parse(await readFile(join(attempt, 'source-config.json')));
    assert.equal(stored.python, process.env.ILLUSTRATED_PYTHON);
    assert.equal(stored.pdftoppm, process.env.ILLUSTRATED_PDFTOPPM);
    assert.ok((await readFile(join(attempt, 'fonts.conf'), 'utf8')).includes('<dir>' + process.env.ILLUSTRATED_FONTS + '</dir>'));
    await verifyStoredContext({ config }, manifest, { attempt });
    for (const field of ['python', 'pdftoppm']) {
      await assert.rejects(verifyStoredContext({ config: { ...config, [field]: join(root, 'untrusted-tool') } }, manifest, { attempt }), /Untrusted retained source configuration/);
    }
  `;
  await execute(process.execPath, ['--input-type=module', '-e', script, helper, root, repository], {
    env: {
      ...process.env,
      ILLUSTRATED_PYTHON: join(root, 'configured-tools', 'python'),
      ILLUSTRATED_PDFTOPPM: join(root, 'configured-tools', 'pdftoppm'),
      ILLUSTRATED_FONTS: join(root, 'configured-fonts'),
    },
    timeout: 10_000,
  });
});
