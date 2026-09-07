# Maintenance and synchronization

The repository remains private. GitHub Pages is off and the deployment workflow is disabled. Use local preview only. Public release requires explicit approval from the repository owner; syncing data or merging a PR does not publish the website.

The **Awesome-World-Action-Model** database in Notion is the editorial source. The exporter writes `data/papers.json` and `data/meta.json`; the website and generated README use the same catalog.

## Sources and missing information

Synchronization reads the entire Notion data source by default, including arXiv, DOI, publisher, PDF, and other recorded research sources. It does not write to Notion, reclassify entries, or exclude records because an abstract, classification, or submission date is missing.

The 2026-09-07 taxonomy snapshot contains 479 entries, all with a major category. Of these, 180 have non-arXiv sources, 305 lack the original `Primary Category` and abstract, and 191 lack `Submitted Date`. An absent original research topic does not mean the new major category, subcategories, or quadrant are missing. These counts describe that snapshot; current totals are calculated from the exported data.

The catalog has 25 explicit fields: the original 19 bibliographic and research fields, plus six taxonomy fields. Preserve missing information instead of inventing it:

| Fields | Rules |
| --- | --- |
| `title`, `authors`, `paperUrl` | Required. The source URL may identify an arXiv entry, DOI record, publisher page, PDF, or another research source. |
| `arxivUrl` | Preserve the arXiv link when present; otherwise use `null`. Do not construct an arXiv link for another source. |
| `submittedDate` | Preserve a complete recorded submission date or `null`. Do not fill it from the publication year or import date. |
| `abstract` | Preserve the recorded abstract or an empty string; do not generate one during synchronization. |
| `primaryCategory`, `secondaryCategories` | Preserve the original nine research topics independently of the new taxonomy. An empty Primary Category becomes `Uncategorized`, meaning the original topic is not recorded. |
| `pdfUrl`, `doi` | Preserve recorded links. DOI links use `https://doi.org/…`; missing links are not inferred. |
| `publicationYear` | A number or `null`, taken only from the year explicitly recorded in Notion. Do not derive it from another date or identifier. |
| `bibtex`, `bibtexKey` | Preserve the recorded citation and key separately; do not invent a citation from incomplete metadata. |
| `majorCategory` | The recorded major category used for the main catalog and README grouping, or `null`. |
| `subcategories` | The recorded subcategory list, or `[]`; distinct from `secondaryCategories`. |
| `architecture`, `predictionParadigm` | The recorded architecture and prediction paradigm, or `null`. |
| `quadrant` | The recorded quadrant or other state, or `null`; do not force an entry into Q1–Q4. |
| `classificationStatus` | The recorded verification status, or `null`; do not infer it from other fields. |

Entries with missing information remain in the collection. Validation still checks URLs, duplicate identities, recorded field formats, empty exports, and unexpectedly large decreases.

Taxonomy definitions and English display labels are shared in `src/lib/taxonomy.mjs`. The website and README use `taxonomyLabel()` for presentation; stored Notion values remain unchanged. Update the shared module when introducing a valid source label rather than maintaining separate definitions in pages or scripts.

## Notion field mapping

The table preserves exact Notion property names, including names originally written in Chinese, for configuring and troubleshooting the importer. Website and README classification labels are displayed in English.

| Exact Notion property | Catalog field |
| --- | --- |
| `Paper Name` | `title` |
| `Paper URL` | `id`, `paperUrl`, `arxivUrl` |
| `Authors` | `authors` |
| `Author Affiliations` | `affiliations` |
| `Contribution` | `contribution` |
| `English Abstract` | `abstract` |
| `Submitted Date` | `submittedDate` |
| `Primary Category` | `primaryCategory` |
| `Secondary Categories` | `secondaryCategories` |
| `BibTeX Key` | `bibtexKey` |
| `BibTeX` | `bibtex` |
| `Publication Year` | `publicationYear` |
| `PDF URL` | `pdfUrl` |
| `DOI` | `doi` |
| `Code URL` | `codeUrls` |
| `Web Page` | `projectUrl` |
| `论文收录` | `venue` |
| `大类` | `majorCategory` |
| `小类` | `subcategories` |
| `架构类型` | `architecture` |
| `预测范式` | `predictionParadigm` |
| `四象限` | `quadrant` |
| `分类状态` | `classificationStatus` |

Internal classification evidence (`分类依据`) can contain private file paths. It is excluded from the export along with retrieval logs (`检索记录`), the internal `Date` property, and raw Notion page metadata. The website, catalog download, and README read only the exported catalog.

## Taxonomy views

The default view follows **major category → subcategory**. The 2026-09-07 snapshot contains Foundational work 139, VLA 35, WAM 227, Datasets 32, Evaluation metrics 14, and Benchmarks & simulators 32: 479 entries in total. The README lists every entry once under its major category and retains the original research topics as a separate summary.

The quadrant view crosses **architecture × prediction paradigm**: One Model or Dual-system, with Joint prediction or IDM. Joint training alone does not establish a One Model architecture. Outside quadrants, Not applicable, and Pending verification remain separate states. In that snapshot, Q1–Q4 contain 38, 9, 27, and 54 entries, respectively; the other states contain 95, 252, and 4. Current website and README counts are computed from the data.

The research map provides `mode=major` (default), `mode=quadrants`, and `mode=topics`. The library combines major-category, subcategory, and quadrant filters. `Uncategorized` applies only to the original Primary Category, not to the overall taxonomy status.

Synchronization displays the classifications already recorded in Notion. To correct them, review the research source, update the relevant Notion property, export again, and inspect the diff and local preview.

## Local preview

Use Node.js 22.12 or a newer 22.x version and keep `package-lock.json` committed:

```bash
npm ci
npm run dev
```

Open the URL printed in the terminal, normally:

```text
http://localhost:4321/Awesome-World-Action-Model/
```

Before submitting a change:

```bash
npm run check
npm test
npm run build
npm run preview
```

`preview` serves the production files in `dist/`. Check search, combined filters, all three map views, paper details, and narrow-screen layouts. Both development and preview servers bind to `127.0.0.1`.

## Routine updates

1. Review paper recommendations or corrections in the private repository, using the paper, DOI record, publisher page, or author-provided source.
2. Update the bibliographic or taxonomy fields in Notion. Preserve the original research topics as separate fields. Apply accepted data corrections there before exporting so the next sync does not overwrite them.
3. Export locally or through the manual Actions workflow below.
4. Review additions, removals, taxonomy changes, the generated README, and category counts. Merging into `main` updates the private repository only.

`README.md` is generated. Change its fixed wording or layout in `scripts/generate-readme.mjs`, then run `npm run generate:readme` instead of editing the generated list directly.

### Export with an authenticated Notion CLI

Install and sign in to `ntn`, then set the **data source ID**. This may differ from both the parent page ID and the database container ID.

```bash
export NOTION_DATA_SOURCE_ID='your-data-source-id'
npm run sync:notion -- --cli
npm run generate:readme
npm run check
npm test
npm run build
git diff -- data/papers.json data/meta.json README.md
```

Alternatively, use `npm run sync:notion -- --cli --source your-data-source-id`. CLI mode uses the existing local login; credentials do not need to be copied into the repository or a conversation.

The exporter does not filter by arXiv source or metadata completeness. It rejects empty results and stops before writing if the entry count decreases by more than 20%. Check permissions, pagination, and the selected source first. Only after confirming an intentional deletion should a maintainer retry locally with `--allow-large-decrease` and review the diff. The explicit `--allow-empty` override is reserved for an intentional reset; normal website validation still requires a nonempty catalog.

### Export manually through GitHub Actions

Configure these settings once:

1. Create a Notion integration with read access and connect the intended database to it.
2. In **Settings → Secrets and variables → Actions → Secrets**, add `NOTION_API_TOKEN` with the integration token.
3. In **Variables**, add `NOTION_DATA_SOURCE_ID` with the intended source ID.
4. In **Settings → Actions → General → Workflow permissions**, allow **Allow GitHub Actions to create and approve pull requests**. The workflow only creates PRs; its required `contents: write` and `pull-requests: write` permissions are declared at job level. Organization policy may restrict this setting. [GitHub permission settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

Enter the token directly in GitHub Secrets. Do not send it to an assistant or put it in source files, Issues, command history, or commits. Building the website from committed data needs no Notion credentials.

Open **Actions → Sync papers from Notion → Run workflow** and select `main`. The workflow exports data, generates the README, runs checks and the build, and creates an `automation/notion-sync-…` branch and PR when data changes. It exits without a PR when nothing changes. There is no scheduled sync.

If the branch is pushed but PR creation fails, use the compare link in that run's Summary to create the PR manually or correct the permission settings. Merge or close an existing sync PR before exporting again to keep review focused.

A PR created with `GITHUB_TOKEN` may require a maintainer to select **Approve workflows to run**. The sync workflow already validates and builds the export, but review the PR's current check status before merging. [GitHub workflow-trigger behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

## Future public release — currently disabled

Do not enable public hosting without explicit approval from the repository owner. A private repository does not necessarily make its GitHub Pages website private. The repository remains private and the website remains unpublished under the current instructions.

GitHub Free supports Pages for public repositories; private repositories need an eligible plan such as GitHub Pro or Team. If the current plan is not eligible, the owner must decide whether to change the plan, choose another host, or explicitly approve making the repository public. No script changes repository visibility. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

Only after explicit approval for a public release:

1. Merge the reviewed website, data, lockfile, and workflows into `main`.
2. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
3. Re-enable **Deploy to GitHub Pages**, select `main`, and explicitly check `publish_publicly` when running it manually. This input defaults to false; pushes to `main` do not deploy.
4. Open the deployment URL reported by the completed job or Pages settings.

There is currently no public site. PR checks only validate and build. The future deployment workflow uses GitHub's official Pages actions, separating read-only build permissions from the deployment job's `pages: write` and `id-token: write` permissions. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Repository paths and future domains

`astro.config.mjs` retains `site: https://beat-in-our-hearts.github.io` and `base: /Awesome-World-Action-Model`. These build settings do not enable hosting. Keep the base path's capitalization consistent with the repository name.

For a future approved rename, fork, or domain change, update `site`, `base`, and external project links before building. A site at a custom domain's root normally uses `/` as its base. Verify detail pages and assets against the resulting paths. [Astro GitHub Pages configuration](https://docs.astro.build/en/guides/deploy/github/)

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Notion returns unauthorized or source not found | Check the integration's database connection, token, and data source ID. In CLI mode, check the signed-in account. |
| A required field is missing | Check the title, authors, and Paper URL. Abstract, classification, and Submitted Date may be absent. |
| An original topic is missing despite a major category or quadrant | These are independent fields. `Uncategorized` refers only to the original Primary Category. |
| A category, abstract, or date is missing, or the quadrant is Pending verification | Preserve the recorded state. Review the source in Notion before changing it. |
| A URL, duplicate identity, or recorded field fails validation | Review the named field or duplicate records. Taxonomy labels must match the shared definitions; missing new fields may be null or empty lists. |
| `npm ci` fails | Check the Node version, network access, and consistency between `package.json` and the lockfile. |
| The old Pages address returns 404 | Expected while public hosting is disabled. Use local preview. |
| Details or styles return 404 in preview | Check `site` and `base`, then rebuild and restart local preview. |
| A sync branch exists without a PR | Use the run Summary's compare link and check Actions PR permissions. |

When upgrading Actions, review the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), and [Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) documentation and validate installation, checks, tests, and the build together.
