#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { loadProject } from './catalog.mjs';
import { repositoryUrl, websiteUrl } from '../lib/catalog.mjs';
try {
  const { config } = await loadProject();
  if (config.mode === 'repo') throw new Error('Repository-only mode has no website deployment.');
  if (!repositoryUrl(config) || !websiteUrl(config)) throw new Error('Set real repository coordinates and site origin before deploying.');
  const { owner, name } = config.repository;
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY.toLowerCase() !== `${owner}/${name}`.toLowerCase()) throw new Error('Configured repository does not match this GitHub Actions repository.');
  const host = new URL(config.site.origin).hostname;
  if (host.endsWith('.github.io')) {
    const expectedBase = name.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '/' : `/${name}/`;
    if (host.toLowerCase() !== `${owner}.github.io`.toLowerCase() || config.site.base !== expectedBase) throw new Error(`Expected https://${owner}.github.io with base ${expectedBase}.`);
  } else {
    const cname = (await readFile(new URL('../public/CNAME', import.meta.url), 'utf8')).trim();
    if (cname !== host) throw new Error('public/CNAME must match the configured custom domain.');
  }
  console.log(`Deployment configuration: ${websiteUrl(config)} (${repositoryUrl(config)}). Verify hosting settings and DNS separately.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
