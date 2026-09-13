---
name: survey-repo-builder
description: Create a topic-independent academic survey website, awesome-list repository, or both from a configurable template. Use for a new survey project, a fork adapted to another research topic, or a standalone literature collection.
---

# Survey Repository Builder

Create a runnable project whose content and taxonomy belong to the user's chosen topic. Use the bundled template; do not copy the host repository's bibliography, authors, taxonomy, figures, or publication history.

## Inputs and scope

Resolve a new output directory and output mode: `repo` (Markdown catalog), `site` (website), or `both`. Collect the title, description, authors, categories and any supplied papers. Repository coordinates and deployment URL are optional for a local draft. Keep unknown information empty; use an empty catalog unless the user requests demo data.

Use `references/configuration.md` for the configuration contract, modes and commands. Topic-specific definitions, category ordering, authors and links live in `survey.config.json`. No account or external database is required.

## Build

1. Prepare the configuration and supplied paper records outside an existing destination. If adopting an existing fork with user changes, inspect it first and prepare the generated project in a new directory for review; the initializer refuses to overwrite a destination.
2. Run this skill's `scripts/create-survey.mjs` with `--config`, optional `--papers`, and `--out`. Resolve the script relative to this skill's location, not a fixed home directory.
3. In the generated project, run `npm run validate:data`, `npm run generate`, and `npm test`. Website modes also require `npm ci`, `npm run check`, and `npm run build`. Use an available local browser to verify the homepage, category filtering, a paper detail page, and the configured URL base.
4. Provide the project directory, commands, outstanding content placeholders, and the verification results. A local build does not establish that a public site was deployed.

Use plain introduction paragraphs and optional TeX equations. Optional figures refer to files the user supplies under `public/assets`; retain attribution and meaningful alternative text. Missing paper abstracts or citations remain blank.

Repository creation, push and public deployment are separate actions. Follow the user's existing authorization and selected destination; creating a local template alone does not request any of them. Do not start periodic searches or add papers while changing the site.

## Reuse

The generated project's `lib/catalog.mjs` defines the generic data contract; `scripts/catalog.mjs` imports and validates data; `scripts/generate.mjs` generates the Markdown views. Reuse those entrypoints when editing a generated project. Keep the template and its contract aligned when changing template capabilities.
