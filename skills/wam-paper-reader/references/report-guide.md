# Evidence and report guide

## Evidence contract

A report cites only sources actually supplied or opened. A source has its canonical URL, observed title, content SHA-256, acquisition time, format and word count. Evidence IDs are unique; claim references must resolve to those IDs and their source IDs. File paths, credentials, raw Notion metadata and internal research logs do not belong in reports.

A location is specific enough to check: `PDF p. 6, Table 2, VLP / Group by Color / completion`, `Section 3.2, Eq. (4)`, or a real HTML heading/fragment. Use stable source notation rather than invented page labels. Evidence detail paraphrases the supported fact; it is not a second unsupported interpretation.

Report status describes reading, not downloading:

- `full-text-reviewed`: identity verified; complete paper body was provided and read. Record appendix and visual-inspection scope separately; disclose omissions.
- `partial-text-reviewed`: only selected sections, an abstract, a truncated extraction, or selected book chapters were read. Do not fill unseen methods/experiments.
- `resource-reviewed`: an official dataset, benchmark, simulator or technical resource was read as documentation. State the actual documentation scope; this does not imply its complete codebase or associated book was read.

An unavailable or mismatched source is a queue record, not a report. Dates and hashes come from the source manifest, not model guesses. `generatedAt` is the report's actual generation time. Related catalog IDs must exist; list relationships only when supported by a source or explicitly described as a catalog suggestion.

Catalog metadata can predate a paper revision. An exact matching primary identifier/title with a substantially matching author list may still establish identity when the newer title page adds an author. Record the observed version and specific catalog discrepancy in coverage or evidence. Do not equate this with a different paper, and do not change the catalog as a side effect. Conflicting identifiers, different works with similar titles, or incompatible authors still require identity resolution before reading.

A changed title requires an explicit primary-source revision chain: for example, the official venue lists the catalog title and links a stable submission whose author revision history identifies the new title and PDF. Verify author continuity and the revised PDF itself before accepting this resolution. Record the original catalog title, observed title, revision identifier/date, and added authors in `identityNotes`. Read and label the verified revision; do not claim the original version was recovered or that the versions are identical.

## Questions by resource

**Method paper:** identify observations, state/latent representation, prediction target, action extraction, feedback, objectives, training stages, frozen modules, inference sequence, relevant equations, data and compute. Extract the strongest result and a mechanism-relevant ablation. Discuss what the experiments do and do not establish.

**Survey or book:** record chapters/sections read, organizing concepts, scope, conceptual assumptions and links to world modeling/control. Do not fabricate a proposed model, ablation or benchmark result. A chapter sample is a partial review.

**Dataset:** task, collection and sampling, scale, modalities, annotations, splits, documented access/license, known bias or leakage risks, and reported baseline protocols. Distinguish original release from subsequent versions.

**Metric:** definition, inputs, direction, units, assumptions, calibration or validation, sensitivity, failure cases and suitable use. Distinguish a metric's formula from empirical evidence of its usefulness.

**Benchmark/simulator:** tasks, environments, interfaces, versions, assumptions, train/test separation, evaluation protocol, reported baselines and reproducibility prerequisites. Distinguish simulated results from physical deployment.

## Critical reading checks

- Are the compared methods evaluated under the same data, split, horizon, compute and success definition?
- Does an ablation isolate the claimed mechanism, or change multiple factors?
- Does evidence concern visual plausibility, dynamics accuracy, planning quality, executed actions, or generalization?
- Are training-time auxiliary prediction and inference-time world-model use being conflated?
- Is a limitation stated by the authors, inferred from the setup, or simply untested?
- What is the smallest meaningful experiment that tests the central mechanism without pretending to reproduce the complete system?

## Acceptance

Reject a report for unresolved source identity, fabricated or unlocatable results, unresolved evidence references, or an inflated reading status. Require concrete, paper-specific content; repeated generic summaries are not close reading. Missing information remains explicit. Preserve the reader's disagreements with the catalog as assessments for later editorial review, never silently revise the catalog.

## Provenance and interpretation details

For PDFs and source archives, `sources[].sha256` is the downloaded artifact's byte hash, not the extracted text hash. The acquisition manifest records the separate text hash. Cite the actual paper version if observed; if no revision is established, say so and identify the artifact by its hash. Give supplements their own source entries.

Separate material present in a downloaded archive from material supplied to this reading. An archive may contain figure PDFs even when the reader receives only extracted text; record that the images were not inspected, rather than claiming the original source lacked them. Likewise, a source can specify some preprocessing thresholds while leaving others unstated: describe the precise gap.

Facts about the reading session itself belong in `coverage.omissions`: for example, code was not inspected, experiments were not reproduced, or figure images were not supplied. These statements do not come from the paper, so do not invent paper evidence for them. Keep `reproduction` for source-grounded requirements, missing implementation details, and clearly marked proposed checks; cite the relevant method or experiment evidence.

`readingTimeMinutes` estimates how long a reader needs for the report; it is not time spent researching. Distinguish measured results from projected, estimated or untested configurations explicitly in each result's value/interpretation. Synopsis and method input/output labels should remain traceable to the cited problem, method steps and evidence.

The taxonomy assessment refers to `taxonomy.recordedClassification`, a coordinator-supplied snapshot of the catalog at reading time. Do not invent or revise that snapshot. Later catalog changes do not retroactively change what the report assessed.
