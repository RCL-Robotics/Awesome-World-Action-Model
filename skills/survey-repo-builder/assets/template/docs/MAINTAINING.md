# Maintaining this survey

This standalone project uses local configuration and JSON records. It does not require an external database or automatically retrieve papers. Source code is covered by `LICENSE`; supplied papers, abstracts and figures retain their original attribution and rights.

## Configure the project

Edit `survey.config.json` for the project identity, authors, language (`en`/`zh`), category definitions, category sort order, introduction sections, optional TeX equations, citation and figures. Place your own attributed image files in `public/assets` and reference them as `/assets/filename.webp`.

`mode` is selected when the project is generated: `repo` for a Markdown collection, `site` for a website, or `both` for synchronized views. To change modes, generate a new destination and carry over your configuration, data and assets; changing this field alone does not install or remove scaffold files.

The default reserved origin `https://example.org` is a local-draft placeholder. Set real repository coordinates and a real origin before publishing. For GitHub project Pages, use `https://OWNER.github.io` with base `/REPOSITORY/`. The special `OWNER.github.io` repository uses base `/`. A custom root domain uses its own origin and base `/`, plus GitHub's domain settings, DNS and `public/CNAME`.

## Maintain the catalog

The authoritative records are in `data/papers.json`. Each record contains:

| Field | Contract |
| --- | --- |
| `id` | Stable lowercase slug; keep it across corrections and source revisions |
| `title`, `url` | Verified paper identity and HTTP(S) source URL |
| `authors` | Array of recorded author names, or `[]` |
| `year`, `date` | Explicit publication year and full recorded date, or `null`; a year is never converted into a made-up date |
| `categories`, `tags` | Arrays; category IDs must exist in the configuration; `[]` is unassigned |
| `abstract`, `summary` | Source abstract and separate editorial summary; empty when unavailable |
| `bibtex` | Supplied citation text, or an empty string |
| `codeUrl`, `projectUrl` | Recorded resource URLs, or `null` |
| `priority` | Optional nonnegative editorial order, lower first; used for relevance browsing, not a citation metric |

One paper can belong to several configured categories, so category totals may overlap. No topic, cutoff year, architecture scheme or classification rule is built into this contract. Write the project's own inclusion criteria in its introduction or category descriptions.

Preview additions from JSON or literal BibTeX:

```sh
node scripts/catalog.mjs import --input /path/to/papers.json --format json
node scripts/catalog.mjs import --input /path/to/references.bib --format bibtex
```

JSON accepts the public fields above; missing optional fields receive empty values only for new records. BibTeX imports preserve the original entry and support braces, quoted fields, nested braces, numeric literals, corporate authors, and explicit URL/DOI/arXiv sources. Expand macros and concatenated values before importing. Complex LaTeX name/title commands may need human normalization; the original BibTeX remains intact. Abstracts, dates and classifications are not inferred from BibTeX prose.

Inspect the preview, then add `--apply` to write. For intentional corrections, add `--update` to both the preview and apply commands. Updates affect only supplied fields, keep stable IDs and preserve other metadata. Existing papers are never removed by import. Duplicate DOI/arXiv URLs are detected; same-title records with different sources stop the batch for identity review. Different-title/different-source versions require human reconciliation.

After approved source changes:

```sh
npm run validate:data
npm run generate
npm test
```

README and `docs/PAPERS.md` are generated; edit configuration or records instead of editing those views. The exact validation and source-identity rules live in `lib/catalog.mjs` and import behavior in `scripts/catalog.mjs`.

## Website modes

```sh
npm ci
npm run check
npm run build
npm run dev
```

Open the displayed localhost origin followed by your configured base, for example `/my-survey/`. Test search with and without category filters, the clear-filters action, dates, paper links and narrow-screen navigation. Name searches prioritize title matches. Category browsing follows the configured sort order; explicit menu/URL sorting overrides the default. Without JavaScript, the whole collection remains readable.

## GitHub and Pages

Create or choose the intended repository, inspect the diff, commit and push only when requested. For public deployment, set **Settings → Pages → Source → GitHub Actions**, then run **Deploy survey website** from Actions on the reviewed branch. The workflow is manual; a push alone does not deploy the website. `npm run check:deploy` checks deployment identity and path locally, but does not verify DNS or create hosting settings.

The bundled PR workflow validates the project. Repository-only output does not include a Pages workflow. Report the pushed commit and deployment result separately. Do not store access tokens or other credentials in the configuration or paper records.
