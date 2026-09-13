#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, root } from './catalog.mjs';
import { dateLabel, filterPapers, labels, repositoryUrl, websiteUrl } from '../lib/catalog.mjs';

const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[|\[\]`*_\\]/g, c => `&#${c.charCodeAt(0)};`).replace(/[\r\n]+/g, ' ');
const link = (label, url) => `[${escape(label)}](<${url.replace(/>/g, '%3E')}>)`;
export function renderDocuments(config, papers) {
  const t = labels(config.language), repo = repositoryUrl(config), site = websiteUrl(config);
  const navigation = [site && link(t.home, site), repo && link('GitHub', repo), config.paperUrl && link(t.paper, config.paperUrl)].filter(Boolean);
  const readme = ['<!-- Generated from survey.config.json and data/papers.json. -->', `# ${escape(config.title)}`, '', escape(config.description), '', navigation.join(' · '), ''];
  if (config.exampleData) readme.push(`> ${t.demo}`, '');
  if (config.authors.length) readme.push(config.authors.map(a => (a.url ? link(a.name, a.url) : escape(a.name)) + (a.affiliation ? ` (${escape(a.affiliation)})` : '')).join(' · '), '');
  if (config.mode !== 'site') {
    for (const section of config.sections) {
      readme.push(`## ${escape(section.heading)}`, '', escape(section.text), '');
      if (section.equation) readme.push('```math', section.equation.replace(/`/g, '\\textasciigrave{}'), '```', '');
    }
    for (const figure of config.figures) readme.push(`![${escape(figure.alt)}](public${figure.src})`, '', escape(figure.caption), '');
    readme.push(`## ${t.categories}`, '', `**${papers.length} ${t.count}**`, '', `| ${t.categories} | ${t.count} |`, '| --- | ---: |');
    for (const c of config.categories) readme.push(`| ${link(c.label, `docs/PAPERS.md#category-${c.id}`)} | ${papers.filter(p => p.categories.includes(c.id)).length} |`);
    if (papers.some(p => !p.categories.length)) readme.push(`| ${link(t.unassigned, 'docs/PAPERS.md#category-unassigned')} | ${papers.filter(p => !p.categories.length).length} |`);
    readme.push('', `## ${t.citation}`, '', config.citation ? '```bibtex\n' + config.citation.replace(/`/g, '\\textasciigrave{}') + '\n```' : t.missingCitation, '');
    if (config.starHistory && repo) readme.push(`## ${t.star}`, '', `[![Star History](https://api.star-history.com/svg?repos=${config.repository.owner}/${config.repository.name}&type=Date)](https://www.star-history.com/#${config.repository.owner}/${config.repository.name}&Date)`, '');
  }
  readme.push(`## ${t.development}`, '', `[${t.maintenance}](docs/MAINTAINING.md)`, '', '```sh', 'npm run validate:data', 'npm run generate', 'npm test', ...(config.mode !== 'repo' ? ['npm ci', 'npm run dev'] : []), '```', '');
  const catalog = [`# ${t.papers}`, '', `[← ${t.home}](../README.md)`, '', ...(config.exampleData ? [`> ${t.demo}`, ''] : [])];
  const groups = [...config.categories, ...(papers.some(p => !p.categories.length) ? [{ id: '__unassigned__', label: t.unassigned, description: '' }] : [])];
  for (const c of groups) {
    catalog.push(`<a id="category-${c.id === '__unassigned__' ? 'unassigned' : c.id}"></a>`, `## ${escape(c.label)}`, '', escape(c.description), '', `| ${t.paper} | ${t.date} |`, '| --- | --- |');
    for (const p of filterPapers(papers, config, { category: c.id })) catalog.push(`| ${link(p.title, p.url)} | ${dateLabel(p)} |`);
    catalog.push('');
  }
  return { readme: readme.join('\n'), catalog: catalog.join('\n') };
}
export async function generate(directory = root) {
  const { config, papers } = await loadProject(directory);
  const docs = renderDocuments(config, papers);
  await mkdir(resolve(directory, 'docs'), { recursive: true });
  await writeFile(resolve(directory, 'README.md'), docs.readme);
  if (config.mode !== 'site') await writeFile(resolve(directory, 'docs/PAPERS.md'), docs.catalog);
  return { mode: config.mode, papers: papers.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generate().then(result => console.log(`Generated ${result.mode} project documentation from ${result.papers} papers.`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
