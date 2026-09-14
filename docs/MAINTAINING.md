# Maintenance and synchronization

The public project website is hosted at [rcl-robotics.github.io/Awesome-World-Action-Models](https://rcl-robotics.github.io/Awesome-World-Action-Models/). Deployments are manual: syncing data or merging a PR updates the repository, and a maintainer publishes the reviewed `main` branch through the Pages workflow.

The separately authorized [weekly literature task](WEEKLY_UPDATE.md) performs incremental arXiv discovery, illustrated reading, classification and publication. It explicitly dispatches the same Pages workflow after validation; an ordinary push still does not deploy. Its schedule lives in Codex, with reusable topics and execution settings in `config/weekly-update.json`.

The **Awesome-World-Action-Model** database in Notion is the editorial source. Reviewed arXiv additions can also be retained in `data/local-papers.json`. The exporter merges both into `data/papers.json` and `data/meta.json`; the website and generated README use the same catalog.

## Reviewed local additions

The 85-paper reading batch integrated on 2026-09-11 adds 85 full-paper reports and illustrated editions with 497 original figure/table crops. Its entries are retained in `data/local-papers.json` so a later Notion export preserves papers that have not yet been added to Notion.

Local titles, authors and affiliations come from the reviewed original title blocks. Contribution summaries are the accepted reports' synopses; they are not paper abstracts. Missing abstracts remain unfilled. The original reading-time classification snapshots and report evidence are preserved. The 2026-09-13 scope review supplies catalog classifications for all 85 additions through the review manifest without rewriting their historical snapshots.

The overlay uses the same 25 public fields and validation as the main catalog. During synchronization, a Notion record with the same ID takes precedence, allowing later editorial updates without duplicate entries. The sync reads but never rewrites the local overlay. Metadata identifies catalogs with local-only entries as `Notion + arXiv discovery`. A missing overlay for an existing mixed-source catalog is an error; restore the file before syncing. Empty-export and large-decrease guards still apply.

To add another reviewed local batch, validate its bibliographic records, merge its accepted reports and illustrated metadata by ID, copy only the referenced public visual assets, and extend the reading index. Keep source PDFs, worker logs and private audit records outside the repository. Do not overwrite accepted reports or regenerate their reading-time snapshots as part of a catalog merge.

## Sources and missing information

Synchronization reads the entire Notion data source by default, including arXiv, DOI, publisher, PDF, and other recorded research sources. It does not write to Notion, infer classifications, or exclude records because an abstract, classification, or submission date is missing. Explicit classification reviews are applied after the source merge.

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

Taxonomy definitions and English display labels are shared in `src/lib/taxonomy.mjs`. The website and README use `taxonomyLabel()` for presentation; source labels remain unchanged except for explicit classification reviews. Update the shared module when introducing a valid source label rather than maintaining separate definitions in pages or scripts.

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

The default view follows **major category → subcategory**. The 2026-09-07 snapshot contains Foundational work 139, VLA 35, WAM 227, Datasets 32, Evaluation metrics 14, and Benchmarks & simulators 32: 479 entries in total. The README provides the survey definition and a navigation index. The generated `docs/PAPERS.md` lists every entry once under its major category and retains the original research topics as a separate summary.

The quadrant view crosses **architecture × prediction paradigm**: One Model or Dual-system, with Joint prediction or IDM. Joint training alone does not establish a One Model architecture. Outside quadrants, Not applicable, and Pending verification remain separate states. In that snapshot, Q1–Q4 contain 38, 9, 27, and 54 entries, respectively; the other states contain 95, 252, and 4. Current website and README counts are computed from the data.

The research map provides `mode=major` (default), `mode=quadrants`, and `mode=topics`. The library combines major-category, subcategory, and quadrant filters. `Uncategorized` applies only to the original Primary Category, not to the overall taxonomy status.

Library browsing defaults to oldest first, except **Foundational work**, which uses an editorial relevance order: world models/model-based RL and latent-action modeling, action-policy foundations, planning/state-estimation theory, diffusion/flow foundations, then general training methods. This order uses the reviewed primary subcategory, with chronological ordering within each group. Keyword searches prioritize title/identifier matches; explicit sort choices in the menu or URL override the defaults.

Synchronization displays the recorded Notion classifications with the explicit local reviews described below. Record source corrections in Notion or evidence-backed classification corrections in the review manifest, then inspect the diff and local preview.

## Classification scope reviews

The 2026-09-13 scope review replaces the earlier broad “reusable contribution” rule. It audits all 224 entries previously in Foundational work, WAM Components, or without a major category. The collection retains 564 source records. See [the review and before/after counts](CLASSIFICATION_REVIEW.md).

**WAM Components** is a curated set of core encoders, pretrained language/vision/video backbones, tokenizers, spatial representations, and canonical action heads, including VAE, CLIP, DINOv2/v3, Wan, and Cosmos backbones. A task-specific WAM, policy adaptation method, runtime, or visual simulator does not become a component merely because it could be reused. Distinguish a backbone from a control system built on it, and self-supervised DINO from the unrelated DINO DETR name.

**Foundational work** is curated historical theory, planning, representation, optimization, and model-based learning published before 2026. Age is necessary but not sufficient: the reason must establish a foundational role. Use the evidenced first release, rather than a later journal publication or revision year. The manifest records this review year without changing source bibliography.

Diffusion Policy belongs here as an action-policy foundation dating to RSS 2023; its later journal edition is not classified as a generic component.

**Related resources** contains relevant surveys, robotics runtimes, supporting representations, security studies, and other adjacent research outside the more specific categories. Dedicated learned simulators belong in **Benchmarks & simulators**. Unrelated or identity-uncertain records stay explicitly unassigned for removal review; they are not forced into Related resources.

`data/classification-overrides.json` version 2 records each stable paper ID, reviewed category and subcategories, an English rationale, valid evidence IDs, and the SHA-256 of the reading report actually reviewed. Architecture, prediction paradigm, and quadrant may be overridden only as a complete, independently evidenced triplet. Foundational entries also require `firstPublicationYear < 2026`. Version 1 remains readable for compatibility, but it is not the current editorial policy.

The exporter merges Notion with `data/local-papers.json`, then applies these explicit reviews. Source titles, dates, abstracts, original research topics, source-review status, and historical reading snapshots remain intact. Reviewed fields take precedence over stale source classifications and are reapplied on every sync. New Foundational or Component entries require an explicit scope review, so an unchecked import cannot silently broaden these curated categories. A review never restores a paper absent from both catalog sources. The importer does not write to Notion or to the review manifest.

`validate:data` verifies the applied decisions, report fingerprints, and evidence references. A changed evidence report requires reviewing and refreshing the affected decision before building. Remove or update a decision only after checking its replacement. Paper detail pages show the current category and review rationale; reading reports preserve their historical taxonomy snapshots and identify when the current classification differs.

## Local preview

Use Node.js 22.12 or a newer 22.x version and keep `package-lock.json` committed:

```bash
npm ci
npm run dev
```

Open the URL printed in the terminal, normally:

```text
http://localhost:4321/Awesome-World-Action-Models/
```

Before submitting a change:

The full test suite uses the pinned Playwright Chromium browser (`npx --no-install playwright install chromium`), Python 3.11 or newer with `Pillow`, `pypdf`, and `reportlab`, and Poppler's `pdftoppm`. Outside the bundled local runtime, set `ILLUSTRATED_PYTHON` and `ILLUSTRATED_PDFTOPPM` to their absolute executable paths, and `ILLUSTRATED_FONTS` to a font directory. The Pages workflow installs and configures these dependencies on Ubuntu before running every test.

```bash
npm run check
npm test
npm run build
npm run preview
```

`preview` serves the production files in `dist/`. Check search, combined filters, all three map views, paper details, and narrow-screen layouts. Both development and preview servers bind to `127.0.0.1`.

## Routine updates

1. Review paper recommendations or corrections in the repository, using the paper, DOI record, publisher page, or author-provided source.
2. Update the bibliographic or taxonomy fields in Notion. Preserve the original research topics as separate fields. Apply accepted data corrections there before exporting so the next sync does not overwrite them.
3. Export locally or through the manual Actions workflow below.
4. Review additions, removals, taxonomy changes, the generated README, and category counts. After merging into `main`, run the manual Pages workflow to publish the update.

`README.md` and `docs/PAPERS.md` are generated together. Change the README definition, navigation, citation placeholder, or layout in `scripts/generate-readme.mjs`, then run `npm run generate:readme`. The paper lists live in `docs/PAPERS.md`; both documents use the same committed catalog. The sync workflow stages both outputs. README-only changes do not require a Pages deployment.

### Export with an authenticated Notion CLI

Install and sign in to `ntn`, then set the **data source ID**. This may differ from both the parent page ID and the database container ID.

```bash
export NOTION_DATA_SOURCE_ID='your-data-source-id'
npm run sync:notion -- --cli
npm run generate:readme
npm run check
npm test
npm run build
git diff -- data/papers.json data/meta.json README.md docs/PAPERS.md
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

## Public website deployment

The repository owner has approved public release. The repository and its GitHub Pages website are public. Website updates use an explicit manual deployment from `main`; pushes and merges do not trigger deployment.

The homepage's bottom-right **Website updated** timestamp is captured in UTC when the static site is built and travels with that deployment artifact. It is separate from **Collection updated**, which describes the catalog data. Refreshing the browser does not change the deployed timestamp; the next published build does.

To publish a reviewed update:

1. Merge the reviewed website, data, lockfile, and workflows into `main`.
2. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, select `main`, and explicitly check `publish_publicly`. This input defaults to false.
4. Open the deployment URL reported by the completed job or Pages settings.

PR checks validate and build. The deployment workflow repeats these checks before publishing with GitHub's official Pages actions, separating read-only build permissions from the deployment job's `pages: write` and `id-token: write` permissions. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Repository paths and future domains

`astro.config.mjs` retains `site: https://rcl-robotics.github.io` and `base: /Awesome-World-Action-Models`. These build settings do not enable hosting. Keep the base path's capitalization consistent with the repository name.

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
| The Pages address returns 404 | Check Pages settings and the latest deployment run. Use the URL reported by the completed deployment, including `/Awesome-World-Action-Models/`. |
| Details or styles return 404 in preview | Check `site` and `base`, then rebuild and restart local preview. |
| A sync branch exists without a PR | Use the run Summary's compare link and check Actions PR permissions. |

When upgrading Actions, review the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), and [Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) documentation and validate installation, checks, tests, and the build together.
