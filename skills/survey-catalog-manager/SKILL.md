---
name: survey-catalog-manager
description: Import, deduplicate, correct and organize literature in a generic survey or awesome-list repository. Use for supplied JSON or BibTeX records, metadata corrections, or taxonomy changes; paper discovery is a separate task.
---

# Survey Catalog Manager

Inspect the target repository's configuration, schema and maintainer guide before changing data. For a project produced by Survey Repository Builder, use `survey.config.json`, `data/papers.json`, `lib/catalog.mjs` and `docs/MAINTAINING.md`. For another project, map its actual contract; do not assume a particular topic or taxonomy.

## Import supplied literature

1. Read the supplied records. Establish title/source identity, distinguish a revision from a distinct paper, and preserve missing dates, abstracts and citations. Do not fabricate bibliographic fields from a filename or an inferred title.
2. Preview with `node scripts/catalog.mjs import --input INPUT --format json` (or `bibtex`). Review added, duplicate, changed and conflicting records. BibTeX import accepts literal brace/quote values and DOI or URL sources; unsupported macros/concatenation must be resolved explicitly before import.
3. `--apply` writes a validated addition batch. Updating explicitly supplied fields of an existing entry additionally requires `--update`; preview that same operation first. This command never deletes existing entries. Conflicting source identities must be resolved before applying.
4. Run `npm run validate:data`, `npm run generate` and `npm test`. For website modes, build and inspect affected filters/detail links.

The importer deduplicates canonical source URLs, DOI links and versioned arXiv links. It does not reliably infer that distinct publisher and preprint URLs identify the same paper; check likely title duplicates in the preview and reconcile them with source evidence. Keep the existing stable ID when correcting a record.

## Category corrections

Use the project's configured definitions and the paper's actual contribution. If evidence is insufficient, keep categories empty and record the unresolved question in the change description. Keep classification edits separate from titles, dates and other bibliography unless the user requests both. Supply a before/after field summary, not just a regenerated Markdown diff.

Do not change generated README/catalog text directly. Update their source configuration or data and regenerate. Do not silently add a discovery job, search for newer papers, or overwrite an external database as part of import or site maintenance.
