# Reading papers and research resources

The reading library is separate from the Notion catalog. `data/papers.json` remains the editorial inventory; `data/reports/<paper-id>.json` contains original English notes based on sources actually read. A Notion import does not replace reading reports.

The website and repository remain private. These commands do not publish the site or write to Notion.

The illustrated reading format follows the [OpenMOSS UniPi report](https://openmoss.ai/Awesome-WAM/report/2302.00111/index.html): a narrow fixed chapter directory on desktop, a full paper title and metadata panel, a paper-overview table, centered numbered sections, and original figures embedded in the explanation. Below 980 px, the directory appears beneath the title panel. The eight sections cover overview, motivation, research context, formulation, method, experiments, limitations and reproducibility. The collection retains its green and ivory palette and heading typography. Our source-attributed reading notes, WAM classification assessment and proposed reproduction checks remain distinct from the reference report's prose. Title-block authors and affiliations are verified from each original PDF and recorded in `data/illustrated-report-metadata.json`.

## Ten-paper review checkpoint

The user requested ten redesigned reports before approving the remaining catalog. `data/report-pilot.json` records those IDs and the `awaiting-user-review` state. The earlier text-only batch has been stopped, and the runner refuses to start while that state is active. Do not remove the checkpoint or infer approval from elapsed time.

The ten illustrated editions are in `data/illustrated-reports/`, with original figure/table crops in `public/report-assets/<paper-id>/`. They supplement the existing evidence records in `data/reports/`; older text notes retain their pages and are labeled separately. The reading index presents the ten samples together. Every Explore card has a bottom-right reading link: completed reports open directly; queued entries open their filtered reading status.

Follow the [illustrated edition guide](../skills/wam-paper-reader/references/illustrated-report-guide.md). Each sample contains 4–6 original visuals, three substantial tutorial steps, two proposed reproduction checks and a visual audit. Each crop records its original PDF hash, page, figure/table number, normalized bounds and image dimensions. Visually inspect both the source page and final crop. Preserve scientific content, headers, axes, legends and relevant footnotes. Never replace the paper's graphics with generated illustrations or reconstructed numbers.

Figures enlarge inside the current page with an accessible dialog and Escape-to-close support. The main report retains equations, training/inference distinctions, results with evaluation settings, classification evidence, limitations and the source ledger. Raw PDFs and intermediate page renders remain outside the repository. Original figures and tables are attributed to the paper's authors.

## The reusable skill

The versioned skill is [WAM Paper Reader](../skills/wam-paper-reader/SKILL.md). Its [evidence guide](../skills/wam-paper-reader/references/report-guide.md) defines source, coverage, result and classification requirements. It can produce standalone Markdown or the website's [report schema](../schemas/reading-report.schema.json).

Example prompt:

> Use $wam-paper-reader and its illustrated edition guide to read this catalog paper from its verified primary PDF. Inspect the method figure, original quantitative tables and ablations, then create faithful attributed crops and verify their legibility. Explain how to read each visual, what it supports and where the evidence stops. Write the English tutorial and trace every scientific claim to source evidence. Preserve separate training/inference explanations, equations, evaluation conditions, taxonomy analysis and proposed reproduction checks. Respect the ten-paper checkpoint; leave remaining work paused until the user approves the samples. Do not update Notion or publish the website.

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

**Currently paused for user review.** The commands below describe the preliminary text-note runner, not the completed illustrated workflow. A text-only run cannot produce a finished illustrated report. Resume catalog-wide work only after the user approves the ten samples and the visual workflow is included in that work.

The runner uses the existing authenticated Codex CLI and its configured model. On macOS it prefers the CLI bundled with the desktop app when available. Set `CODEX_BIN` to choose another compatible executable; no API key is embedded in the project.

```sh
# Validate existing reports and refresh the site-safe queue.
npm run validate:reports
npm run reading:index

# Show current source and reading totals, and the local worker state.
npm run reading:status

# Calibrate on one prepared paper first.
npm run reading:run -- --ids 2302.13971 --limit 1

# Read all remaining prepared sources, one at a time.
npm run reading:run

# Consume sources as the acquisition batch makes them available.
npm run reading:run -- --watch-sources --concurrency 2

# Retry failed readings after correcting their input or execution problem.
npm run reading:run -- --retry-errors
```

`--work-dir` selects another external cache. `--concurrency` accepts 1 or 2; the default is 1. `--limit` bounds new attempts. Completed reports are skipped. Each accepted report is written atomically, and failed drafts stay outside the repository for inspection. Three consecutive reader/validation failures stop the run. A single active-run lock prevents duplicate workers; after an abnormal termination, verify the recorded process is gone before removing a stale lock.

To finish the current group before stopping, send `SIGUSR1` to the coordinator PID recorded in the external `reading.lock`. `SIGINT`/`SIGTERM` stop active attempts; those interrupted entries resume on the next run. The coordinator retains its lock until its readers have exited and its final queue update is saved.

The runner supplies the complete prepared text when it fits its bounded prompt. A source exceeding 500,000 text characters is explicitly treated as a partial reading, with that omission recorded. Images are not visually inspected by this text-only runner. When a result depends on a figure or ambiguously extracted table, perform an additional visual reading before including it. The source's recorded word count describes the source, not an assertion that every word was supplied in a partial pass.

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

Validation checks schema fields, catalog identities, source fingerprints, safe URLs, evidence/source references, coverage/status consistency and private-path leakage. Illustrated validation additionally checks the ten-paper scope, original visual types, PDF-page links, normalized crop bounds, PNG dimensions, attribution and recorded inspection of every cropped page. It cannot prove the scientific interpretation is correct. Independently inspect important numerical results, primary-source locations, classification assessments and extraction ambiguities. Keep unavailable and partial items visible when reporting batch coverage; do not describe the entire catalog as fully read until the recorded coverage supports that statement.
