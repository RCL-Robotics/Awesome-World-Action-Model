# Build your own survey repository

This repository includes a topic-independent starter for academic survey websites and awesome-list repositories. Its own configuration and bibliography are separate from the starter. Generating a project does not copy the host collection or change its website.

## Reusable skills

| Skill | Job |
| --- | --- |
| [survey-repo-builder](../skills/survey-repo-builder/SKILL.md) | Create a new repository-only project, website, or both |
| [survey-catalog-manager](../skills/survey-catalog-manager/SKILL.md) | Preview/import supplied JSON or BibTeX, deduplicate sources and maintain the configured taxonomy |
| [survey-site-publisher](../skills/survey-site-publisher/SKILL.md) | Verify a chosen remote, configure hosting paths and perform a requested push or deployment |
| [survey-weekly-updater](../skills/survey-weekly-updater/SKILL.md) | Coordinate incremental arXiv discovery, reading, classification and an authorized release; includes a private resumable candidate queue |

Canonical skill directories live in `skills/`; `.agents/skills/` links to them for repository discovery in Codex. The builder includes its own template and scripts, so it can also be installed as a standalone skill. The generated project runs using ordinary Node.js/npm commands; an AI assistant is optional. Other assistants can read the same `SKILL.md` instructions or use their own supported installation method.

For example:

> Use $survey-repo-builder to create an efficient-learning survey in a new directory. Generate both a GitHub README catalog and a website. Use my supplied taxonomy and references; leave other research content empty.

## Try the example

With Node.js 22.12 or later, run from this repository's root:

```sh
node skills/survey-repo-builder/scripts/create-survey.mjs \
  --config examples/efficient-learning/survey.config.json \
  --papers examples/efficient-learning/papers.json \
  --out ../efficient-learning-survey

cd ../efficient-learning-survey
npm ci
npm test
npm run check
npm run build
npm run dev
```

Open the displayed localhost origin at `/efficient-learning/`. The three example records are explicitly fictional and link to reserved `example.org` URLs. They demonstrate layout, categories and search; they are not new literature or scholarly claims.

The destination must not exist. Generation never overwrites an existing project. It does not create GitHub repositories, push commits, search for papers or deploy anything.

## Start with your own project

Copy [the starter configuration](../skills/survey-repo-builder/assets/template/survey.config.json), then change its title, description, authors, language, categories, introduction and links. Run the same generator with that configuration. Omit `--papers` for an empty catalog, or provide validated JSON. The configuration reference is [here](../skills/survey-repo-builder/references/configuration.md).

| Mode | Generated output |
| --- | --- |
| `repo` | README navigation, categorized `docs/PAPERS.md`, import/validation scripts and tests; no website dependencies |
| `site` | Responsive Astro website with home, categories, searchable paper library and detail pages; short setup README |
| `both` | Website and complete Markdown views generated from the same data |

Set the mode in configuration or pass `--mode repo`, `--mode site` or `--mode both`. This is a generation-time choice.

The site supports English/Chinese interface labels, configurable accent color, attributed local figures, optional TeX equations, survey citation and an optional repository Star History chart. All category definitions are project-supplied. Relevance browsing uses an optional editorial `priority`; it does not invent citation counts or infer a discipline-specific hierarchy.

## Add literature

Inside the generated project:

```sh
node scripts/catalog.mjs import --input /path/to/references.bib --format bibtex
node scripts/catalog.mjs import --input /path/to/references.bib --format bibtex --apply
npm run generate
```

The first command previews the change; the second applies it after review. Use JSON for classifications, summaries and other detailed metadata. Updating existing entries additionally requires `--update` in both commands. Import preserves unspecified fields, rejects duplicate/conflicting identities, and never removes existing records. The supported BibTeX subset and identity limits are documented in each generated project's `docs/MAINTAINING.md`.

Metadata collection, reading, taxonomy decisions, repository push and website publication are separate operations. No automatic paper discovery or external database synchronization is configured by this starter.

To add recurring updates, adapt the weekly updater to the new project's own queries, schema, primary-source reader and release destination, then schedule it explicitly. The current collection's [weekly runbook](WEEKLY_UPDATE.md) is an integration example, not a transferable publishing authorization or subject taxonomy.

## Publish your own site

Set your repository coordinates and hosting origin/base in configuration. Generate/validate/build the project, then push to your selected repository when ready. Configure GitHub Pages to use GitHub Actions and run the generated **Deploy survey website** workflow manually. Repository-only mode has no deployment workflow. Custom domains also require host settings, DNS and `public/CNAME`.

Do not publish the reserved example origin, demonstration bibliography or another project's authors as your own research. Keep the included source-code license and preserve attribution for any paper content or figures you add.
