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

export async function privateWorkDirectory(value, repositoryRoot) {
  // Resolve every existing ancestor, including a symlink at the requested directory.
  let ancestor = resolve(value);
  const missing = [];
  let actual;
  while (true) {
    try { actual = resolve(await realpath(ancestor), ...missing); break; }
    catch (error) {
      if (error.code !== 'ENOENT' || dirname(ancestor) === ancestor) throw error;
      missing.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
  const within = relative(await realpath(repositoryRoot), actual);
  if (!(isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`))) {
    throw new Error('Reader prompts and source material must stay outside the repository. Choose an external --work-dir.');
  }
  return actual;
}
