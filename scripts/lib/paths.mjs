import { realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, basename, sep } from 'node:path';

export async function privateSnapshotPath(value, repositoryRoot) {
  const target = resolve(value);
  // Resolve the existing parent to prevent raw exports through a symlink into the repository.
  const actual = resolve(await realpath(dirname(target)), basename(target));
  const within = relative(await realpath(repositoryRoot), actual);
  const outside = isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`);
  if (!outside) throw new Error('Raw snapshots contain private Notion metadata. --snapshot must point outside this repository.');
  return actual;
}
