# Reading papers and research resources

The reading library is separate from the Notion catalog. `data/papers.json` remains the editorial inventory; `data/reports/<paper-id>.json` contains original English notes based on sources actually read. A Notion import does not replace reading reports.

The website and repository remain private. These commands do not publish the site or write to Notion.

The illustrated reading format follows the [OpenMOSS UniPi report](https://openmoss.ai/Awesome-WAM/report/2302.00111/index.html): a narrow fixed chapter directory on desktop, a full paper title and metadata panel, a paper-overview table, centered numbered sections, and original figures embedded in the explanation. Below 980 px, the directory appears beneath the title panel. The eight sections cover overview, motivation, research context, formulation, method, experiments, limitations and reproducibility. The collection retains its green and ivory palette and heading typography. Our source-attributed reading notes, WAM classification assessment and proposed reproduction checks remain distinct from the reference report's prose. Title-block authors and affiliations are verified from each original PDF and recorded in `data/illustrated-report-metadata.json`.

## Approved format and review checkpoint

The user approved the ten redesigned reports on September 8, 2026 (Asia/Dubai) and requested the rest of the catalog in the same format after committing and pushing the pilot. `data/report-pilot.json` records the approval time and retains those ten IDs. The collection keeps the pilot first, followed by accepted editions in catalog order. If a checkpoint is set to `awaiting-user-review`, processing the remainder is blocked; elapsed time is not approval.

Illustrated editions are in `data/illustrated-reports/`, with original figure/table crops in `public/report-assets/<paper-id>/`. They supplement the existing evidence records in `data/reports/`; older text notes retain their pages and are labeled separately until their illustrated edition is complete. Every Explore card has a bottom-right reading link: completed reports open directly; queued entries open their filtered reading status.

Follow the [illustrated edition guide](../skills/wam-paper-reader/references/illustrated-report-guide.md). A standard edition contains 4–6 original visuals, three substantial tutorial steps, two proposed reproduction checks and a visual audit. Each crop records its original PDF hash, page, figure/table number, normalized bounds and image dimensions. Visually inspect both the source page and final crop. Preserve scientific content, headers, axes, legends and relevant footnotes. Never replace the paper's graphics with generated illustrations or reconstructed numbers.

Surveys, theory and partial readings can document source-grounded `visualLimitations` to explain fewer visuals or the absence of quantitative tables or ablations. They still require at least one inspected original PDF visual. Abstract-only or no-PDF resources remain honestly scoped text reports with a private `illustration-unavailable` outcome, never an empty illustrated edition. Verified title metadata is required for every accepted edition. An optional `featuredResultTask` selects an existing result for the overview; it does not supply a new result.

Figures enlarge inside the current page with an accessible dialog and Escape-to-close support. The main report retains equations, training/inference distinctions, results with evaluation settings, classification evidence, limitations and the source ledger. Raw PDFs and intermediate page renders remain outside the repository. Original figures and tables are attributed to the paper's authors.

## The reusable skill

The versioned skill is [WAM Paper Reader](../skills/wam-paper-reader/SKILL.md). Its [evidence guide](../skills/wam-paper-reader/references/report-guide.md) defines source, coverage, result and classification requirements. It can produce standalone Markdown or the website's [report schema](../schemas/reading-report.schema.json).

Example prompt:

> Use $wam-paper-reader and its illustrated edition guide to read this catalog paper from its verified primary PDF in the approved format. Inspect the method figure, original quantitative tables and ablations, then create faithful attributed crops and verify their legibility. Explain how to read each visual, what it supports and where the evidence stops. Write the English tutorial and trace every scientific claim to source evidence. Preserve separate training/inference explanations, equations, evaluation conditions, taxonomy analysis and proposed reproduction checks. Record source limitations explicitly and do not invent missing experiments. Do not update Notion or publish the website.

## Source preparation

Store raw downloads, extracted text, source manifests, drafts and execution logs in a working directory outside this repository, such as `../reading_work`. Do not place PDFs, LaTeX archives, raw Notion exports or execution prompts in `public/`.

Each `sources/<paper-id>/manifest.json` records the source URL, observed identity, format, acquisition time, fingerprint, word count, text location and available sections. Source access is tracked separately from reading completion. Inspect the preparation script's help for retrieval and resume options.

```sh
# Create an isolated Python environment if one is not already available.
python3 -m venv ../reading_work/.venv
../reading_work/.venv/bin/python -m pip install -r scripts/reading/requirements.txt
../reading_work/.venv/bin/python scripts/reading/prepare-sources.py --workers 2
```

Only a verified, readable primary source can enter the reading runner. Identity mismatches and inaccessible sources remain visible in the queue. A source file is not proof that the resource was fully read.

## Read and resume

The illustrated runner resumes work by completed bundles, including existing text notes that still need a visual pass. It validates the base report, edition, original PNG assets and title metadata together. Isolated attempts, logs and unavailable outcomes remain outside the repository under `illustrated-runs/<paper-id>/` in the work directory.

The runner uses the existing authenticated Codex CLI and its configured model. On macOS it prefers the CLI bundled with the desktop app when available. Set `CODEX_BIN` to choose another compatible executable; no API key is embedded in the project.

```sh
# Validate existing reports and refresh the site-safe queue.
npm run validate:reports
npm run reading:index

# Show current source and reading totals, and the local worker state.
npm run reading:status

# Inspect the illustrated work queue without starting a reader.
npm run reading:illustrated -- --dry-run

# Inspect the illustrated coordinator and per-paper progress.
npm run reading:illustrated:status

# Read one prepared paper and inspect its completed bundle first.
node scripts/reading/run-illustrated.mjs --ids 2302.13971 --limit 1

# Read all remaining prepared sources, one at a time.
node scripts/reading/run-illustrated.mjs

# Process two independent prepared sources concurrently.
node scripts/reading/run-illustrated.mjs --concurrency 2

# Retry failed readings after correcting their input or execution problem.
node scripts/reading/run-illustrated.mjs --retry-errors

# Revalidate complete retained drafts; generate fresh work only for incomplete drafts.
node scripts/reading/run-illustrated.mjs --retry-errors --resume-drafts --concurrency 2
```

`--work-dir` selects another external cache (default `../reading_work`). `--concurrency` accepts 1 or 2; the default is 1. `--limit` bounds scheduled entries. `--timeout-minutes` bounds each writer or independent reviewer (default 40). Completed bundles are checked before being skipped; a base JSON alone is not illustrated completion. `--recover-stale-lock` is for a stale coordinator lock after confirming its process has ended. Failed drafts remain private for inspection. `--resume-drafts` verifies the retained runtime paths, source identity, complete text-chunk inventory and catalog snapshot before reusing a draft; it still requires original-pixel verification and independent visual review.

A validation failure receives one corrective writing pass with the exact diagnostic and any rejected visual-review details. Previous prompts, logs and receipts are retained in `worker-history/`; a second failure remains private. Three consecutive failures stop new scheduling while already-running entries finish normally. Explicit interrupts and per-reader timeouts still stop the affected processes. A stopped batch needs attention; it is not ongoing progress.

The coordinator preserves the source manifest's acquisition limitations in every accepted report, alongside the writer's more specific coverage disclosures. This records limitations independently of whether the writer paraphrased them or inspected the original images to address them. Text chunks are checked as original UTF-8 bytes so CR and CRLF line endings cannot produce false integrity failures.

To finish the current group before stopping, send `SIGUSR1` to the illustrated coordinator. `SIGINT`/`SIGTERM` stop active attempts; interrupted entries resume on the next run. Per-paper status is recorded in the external `illustrated-runs/<paper-id>/status.json`. A source with insufficient illustration material receives `illustration-unavailable` with a precise reason and evidence, while its text report retains the appropriate reading scope.

The earlier `npm run reading:run` command remains a preliminary text-note workflow. It supplies prepared text, explicitly marks truncation beyond 500,000 characters, and does not inspect images. It cannot complete the approved illustrated format. In either workflow, the source's word count describes the source, not a claim that every word was read in a partial pass.

Each new illustrated bundle receives a separate visual review before acceptance. The coordinator independently renders the declared PDF pages and verifies crop pixels, then attaches the source pages and final crops to a read-only reviewer. The reviewer checks identity, legibility, figure/table labels and the claims made about each visual. A failed check leaves the draft private; the website receives only accepted bundles. Review context, image fingerprints and receipts are retained in the external work directory for inspection and interrupted-run recovery.

## What the status means

- **Full-text reviewed:** the complete main paper text was reviewed. The report separately states appendix and figure coverage.
- **Partially reviewed:** selected sections, an abstract, a truncated source or selected book chapters were reviewed.
- **Resource reviewed:** official resource documentation was reviewed within the recorded scope; this does not imply every associated code file or book chapter was read.
- **Queued:** no accepted report exists yet, even if source text is available.
- **Source unavailable / identity mismatch:** acquisition could not establish a readable matching source.
- **Needs retry:** an execution or report-validation attempt failed.

Reports are AI-assisted research notes, not claims of reproduced experiments. They distinguish paper statements, author interpretations, reader analysis and open questions. Taxonomy assessments may support, question or disagree with the recorded classification; they never silently overwrite the catalog.

## Acceptance and verification

```sh
npm run validate:reports
npm test
npm run check
npm run build
```

Validation checks schema fields, catalog identities, source fingerprints, safe URLs, evidence/source references, coverage/status consistency and private-path leakage. Illustrated validation additionally checks the approval gate, retention of all ten pilot reports, verified title metadata, original visual types, PDF-page links, normalized crop bounds, PNG dimensions, attribution and recorded inspection of every cropped page. Exceptions require explicit source-grounded visual limitations; abstract-only and empty editions are rejected. Validation cannot prove the scientific interpretation is correct. Independently inspect important numerical results, primary-source locations, classification assessments and extraction ambiguities. Keep unavailable and partial items visible when reporting batch coverage; do not describe the entire catalog as fully read until the recorded coverage supports that statement.
