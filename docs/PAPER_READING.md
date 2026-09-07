# Reading papers and research resources

The reading library is separate from the Notion catalog. `data/papers.json` remains the editorial inventory; `data/reports/<paper-id>.json` contains original English notes based on sources actually read. A Notion import does not replace reading reports.

The website and repository remain private. These commands do not publish the site or write to Notion.

The chapter-based reading experience was informed by the [OpenMOSS VLP report](https://openmoss.ai/Awesome-WAM/report/2310.10625/index.en.html). This site's Research Notes design uses its own blue-gray and amber palette, right-side navigation, mechanism flow, linked evidence, explicit reading coverage and preserved classification snapshots.

## The reusable skill

The versioned skill is [WAM Paper Reader](../skills/wam-paper-reader/SKILL.md). Its [evidence guide](../skills/wam-paper-reader/references/report-guide.md) defines source, coverage, result and classification requirements. It can produce standalone Markdown or the website's [report schema](../schemas/reading-report.schema.json).

Example prompt:

> Use $wam-paper-reader to read this catalog paper from its primary source. Write an original English research report with a mechanism explanation, separate training and inference, source-located experimental results, limitations, reproducibility requirements and a review of its recorded taxonomy. Record the actual reading coverage. Do not infer missing details from the title or abstract, and do not update Notion or publish the website.

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

Validation checks schema fields, catalog identities, source fingerprints, safe URLs, evidence/source references, coverage/status consistency and private-path leakage. It cannot prove the scientific interpretation is correct. Independently inspect important numerical results, primary-source locations, classification assessments and extraction ambiguities. Keep unavailable and partial items visible when reporting batch coverage; do not describe the entire catalog as fully read until the recorded coverage supports that statement.
