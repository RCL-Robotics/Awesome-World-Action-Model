# Weekly literature update

This project uses a weekly Codex task to discover and read new arXiv papers, apply evidence-based classification, update the organization repository and deploy GitHub Pages. The maintainer authorized this complete recurring workflow on 2026-09-14. The configured cadence is Monday at 09:00 Asia/Dubai (UTC+04:00). The task is attached to the existing Codex conversation; its actual schedule is managed with the app's automation tool, not by this JSON file or GitHub Actions.

The public, reusable configuration is [config/weekly-update.json](../config/weekly-update.json). The topic-independent [survey-weekly-updater skill](../skills/survey-weekly-updater/SKILL.md) and its Python helper can be reused by another survey with its own queries, reader, schema, categories and publishing destination. Copying this repository does not install a schedule or grant publication permission for a fork.

## Runtime and destination

- Keep the local computer on and Codex running at the scheduled time. Maintain usable Codex CLI authentication/model allowance, GitHub push and workflow-dispatch access, and internet access to primary sources. A missed local run is not guaranteed to execute while the computer is off.
- Publish only to `RCL-Robotics/Awesome-World-Action-Models`, branch `main`; the personal `origin` remote in the development checkout is not the release destination. Verify the organization remote URL before any push.
- Use the installed authenticated `codex` CLI via `CODEX_BIN`, and Python/PDF runtimes from the existing environment. Follow [PAPER_READING.md](PAPER_READING.md); do not create API keys or change account settings as a side effect.
- Use an isolated Git worktree. Keep persistent state in a sibling working directory such as `../reading_work/weekly-survey/`, outside the public repository. All paths in examples below are relative to the development repository root unless stated otherwise.
- Preserve an unfinished release checkout, reader attempts and status files after interruption. Record the checkout path, base SHA, selected/accepted IDs, pushed SHA, deployment run ID and phase in a private `run.json`. Use an exclusive private run lock with owner/process information; never remove a lock belonging to a live process.

## 1. Resume and discover

Inspect the prior `run.json` first. If a commit is already pushed but not deployed, verify or retry that Pages release before starting another batch. If the previous checkout contains unfinished reading, resume it and its queue. Do not reset user changes or delete unfinished drafts to obtain a clean tree.

Fetch the organization remote and create a release worktree from its latest `main` for a fresh batch. Install dependencies with `npm ci` inside that worktree. Keep private state and source caches at a stable absolute path outside both checkouts. The scheduler prompt supplies this machine's paths; do not commit those paths.

Discovery deduplicates against a committed catalog. Finish or privately retain temporary reading-stage records before a new scan; do not pass temporary candidate additions as already-published catalog entries.

From the release checkout:

```sh
python3 skills/survey-weekly-updater/scripts/arxiv_queue.py discover \
  --config config/weekly-update.json --catalog data/papers.json \
  --state-dir /absolute/private/weekly-survey/queue
python3 skills/survey-weekly-updater/scripts/arxiv_queue.py status \
  --state-dir /absolute/private/weekly-survey/queue
```

Use Python 3.10 or newer. `discover --plan` validates configuration and prints the UTC window without network or writes. `discover --probe` checks a real first page without consuming the discovery cursor; it is only a connectivity check. A normal discovery stores its candidate records in `queue/state.json` and advances `lastSuccessfulScan` only after every configured query is completely paginated. The first scan covers nine days; later scans overlap the previous complete scan by two days. A query change restarts the configured initial window. This is a new-submission monitor, not a complete historical backfill or a monitor of revisions to old submissions.

For this setup, `firstScanFrom` extends the first scan back to 2026-09-05 UTC even if the first scheduled execution is later. This avoids missing papers between configuration and the first run. Once a complete scan is recorded, the saved cursor controls subsequent windows. Forks should select their own initial date.

An incomplete scan retains fetched candidates but not a successful cursor. Investigate the recorded failure; bounded retries or a legitimate primary-source lookup can resolve it. Do not replace an API error with a fabricated empty result. If recovery cannot complete this run, finish already verified work and report the incomplete search window.

## 2. Screen and stage candidates

Read `scope` in the configuration, [CLASSIFICATION_REVIEW.md](CLASSIFICATION_REVIEW.md), and the current taxonomy in `src/lib/taxonomy.mjs`. Inspect the queue's new and earlier unfinished entries. Existing arXiv IDs and DOI matches do not become new records; inspect title-only collisions before a decision. Screen title/abstract for relevance, then verify the selected source identity. A search match alone is not acceptance.

Record each decision with the helper's `decide --id ID --status selected|excluded|retry --reason TEXT` command. Reasons should describe the actual topical contribution, identity issue or access failure. Do not mark a catalog match as newly read. Never reset all historical exclusions each week.

Before reading, save immutable copies of the base catalog, local overlay, classification manifest and metadata in the private run directory. Stage selected new records in the isolated release checkout because the existing reader resolves IDs from `data/papers.json`.

- Build exactly the 25 catalog fields documented in [MAINTAINING.md](MAINTAINING.md), with canonical versionless `paperUrl`/`arxivUrl`, the observed versioned `pdfUrl`, verified title/authors, the source abstract and actual submitted date. Preserve missing fields; do not infer a publication year, affiliation, code/project URL, venue, BibTeX or classification.
- Preliminary taxonomy fields may be `null`/`[]`, and the original research-topic field may be `Uncategorized`. This is staging, not public acceptance.
- Append to both `data/local-papers.json` and `data/papers.json`; do not replace existing entries. Use `validatePapers`, `sortPapers`, `buildMeta` and `atomicWriteFiles` from `scripts/lib/data.mjs`; metadata source remains `Notion + arXiv discovery`.
- Do not run Notion synchronization or write to Notion as part of this task. The local overlay preserves these additions during a later authorized sync.

## 3. Read and classify from evidence

Prepare only the selected IDs; repeat `--only` for each one:

```sh
python3 scripts/reading/prepare-sources.py \
  --work-dir /absolute/private/weekly-survey/reading --workers 2 \
  --only PAPER_ID
node scripts/reading/run-illustrated.mjs \
  --work-dir /absolute/private/weekly-survey/reading \
  --ids COMMA_SEPARATED_IDS --concurrency 2 --timeout-minutes 40
```

Use the prepared Python environment with `pypdf`, Pillow and reportlab installed; set `ILLUSTRATED_PYTHON`, `ILLUSTRATED_PDFTOPPM` and `ILLUSTRATED_FONTS` to verified runtime paths where needed. The runner uses the authenticated CLI and handles independent visual review, artifact validation and serial repository writes. Its accepted ten-paper pilot is already recorded in `data/report-pilot.json`; no new pilot is needed for the same approved format. Existing source versions and acquisition fingerprints must still match when resuming.

For queued acquisition failures, rerun `prepare-sources.py` with `--retry` and the same explicit `--only` IDs before retrying the reader. Without `--retry`, a cached unavailable manifest is returned without another fetch. Reader repair flags do not retry downloads. Verified complete sources remain cached; changed source bytes require a fresh reading attempt rather than an incompatible retained draft.

The `wam-paper-reader` skill and illustrated guide govern reading. Read methods, training/inference, equations, results and limitations; inspect the original figures/tables and retained crops. Do not use the preliminary text runner as an illustrated substitute. Resume repairable attempts with `--retry-errors --resume-drafts`; never bypass source, image or reviewer checks. Stop repeated failed attempts and retain their specific reasons. An unavailable/partial reading remains explicitly incomplete and is not released as a newly completed paper.

For each accepted complete illustrated report, independently check a substantive result and the category conclusion against its source evidence. Extend `data/classification-overrides.json` version 2 with the new ID, major category/subcategories, any jointly justified axis corrections, evidence IDs, reason and SHA-256 of the accepted report bytes. Use the existing manifest schema and validators. Apply the overrides to the catalog with `applyClassificationOverrides`; preserve the report's reading-time snapshot. Do not rewrite historical reviews or their evidence hashes.

New papers from 2026 onward cannot be Foundational work. Components must be actual core encoders/backbones/tokenizers or other specifically justified components; a task-specific world/action system is not a component because it contains one. Related resources is for relevant adjacent resources, not unrelated keyword matches. Uncertain axes stay unverified/outside/not-applicable as the evidence warrants.

Before publication reconstruct the catalog/overlay from the immutable base plus only the accepted new IDs. Remove only this batch's incomplete additions, associated staged reports/assets/metadata and provisional overrides; retain those artifacts privately for retry. Preserve all preexisting files and entries. Regenerate `data/reading-index.json`. Accepted/public status must reflect actual report coverage, not source-download success. Mark ready entries `accepted`; `published` is reserved for the completed release.

## 4. Validate, push and deploy

```sh
npm run reading:index
npm run generate:readme
npm run validate:data
npm run validate:reports
npm test
npm run check
npm run build
```

Inspect representative paper/library/report pages locally. Install the locked test browser when needed (`npx --no-install playwright install chromium`); use the required Python/PDF test environment. Review the public diff for unintended edits and private paths. Keep downloads, prompts, queue decisions and raw logs outside the commit. If no new paper is accepted, leave the public catalog and timestamps unchanged.

Commit only the intended catalog, overlay, classification manifest, metadata, generated Markdown/index, accepted reports and original visual assets. Fetch the organization remote again. Reconcile concurrent main changes without discarding either side or force-pushing; revalidate affected results. Push the release commit explicitly to the organization remote's `main` and immediately save its SHA in the private run record.

```sh
gh workflow run deploy.yml \
  --repo RCL-Robotics/Awesome-World-Action-Models --ref main \
  -f publish_publicly=true
```

Resolve the dispatched run from its time and `headSha`, save its ID, wait for success, and verify the GitHub Pages deployment SHA/status/URL. If another main commit lands before dispatch, inspect the actual deployed head and confirm the accepted release is included. The homepage build timestamp is generated automatically. A successful push or build does not establish successful publication.

On success, mark accepted IDs `published` with the release SHA and deployment URL in their decision reason, finalize the private run record and release the run lock. Send a concise Chinese report: discovered/selected/read/published counts, unresolved IDs/reasons, commit link and Pages link. Stay quiet when a complete scan finds no actionable changes; report failures or unresolved publication.

## Configuration checks

The discovery queue tests run with the normal JavaScript suite through `tests/weekly-update.test.mjs`. They use synthetic Atom responses and private temporary directories; they neither read new papers nor publish content. Test a live `--probe` separately to establish connectivity. Neither check should be described as an end-to-end scientific reading or a new website release.
