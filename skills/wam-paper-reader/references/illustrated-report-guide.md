# Illustrated reading edition

The user approved the ten samples on September 8, 2026 (Asia/Dubai). `data/report-pilot.json` records this approval and preserves the original ten IDs. Continue the remaining catalog using this format. If the checkpoint is `awaiting-user-review`, additions beyond the pilot remain blocked until explicit approval.

An illustrated edition complements the evidence record in `data/reports/<id>.json` and lives in `data/illustrated-reports/<id>.json`. Read the original source text and visually inspect the relevant PDF pages, then inspect every final crop. Never derive scientific content from a reference site's report. Do not execute paper code.

Use this core shape (all fields shown here are required; optional extensions follow):

```
{
  "schemaVersion": 1,
  "paperId": "catalog ID",
  "shortTitle": "SA-WAM",
  "thesis": "One concrete sentence explaining the method and its tradeoff.",
  "standfirst": "An original explanatory introduction, about 80–130 words, setting up the reading.",
  "evidenceIds": ["existing base-report evidence ID supporting the introduction"],
  "visuals": [{
    "id": "architecture",
    "kind": "figure",
    "section": "mechanism",
    "sourceLabel": "Figure 2",
    "page": 2,
    "asset": "report-assets/<id>/architecture.png",
    "width": 1500,
    "height": 600,
    "sourceSha256": "same immutable PDF hash as the base report",
    "sourceUrl": "https://arxiv.org/pdf/<id>#page=2",
    "crop": [0.05, 0.08, 0.95, 0.42],
    "alt": "A useful description of the actual graphic.",
    "caption": "Short original caption, not a copied paper caption.",
    "readingGuide": "Explain how to follow the figure or table, with paper-specific symbols, blocks, rows or columns. About 80–140 words.",
    "takeaway": "Explain the finding supported by this visual, including numbers only when legible. About 40–80 words.",
    "caution": "An explicit evidence boundary or unresolved question relevant to this visual. About 25–60 words.",
    "evidenceIds": ["existing evidence IDs"]
  }],
  "walkthrough": [{
    "heading": "A paper-specific tutorial step",
    "text": "A substantial, original explanation of the causal reasoning or architectural choice, grounded in source text. About 100–160 words. Label interpretive deductions in the prose.",
    "kind": "source",
    "evidenceIds": ["existing evidence IDs"]
  }],
  "reproductionChecks": [{
    "title": "A discriminating experiment",
    "text": "A concrete reader-proposed comparison, control and falsifiable observation. Not a claim that any experiment was run.",
    "evidenceIds": ["existing evidence IDs motivating the proposal"]
  }],
  "visualAudit": {
    "inspectedPages": [2, 4, 5],
    "notes": "State which images/tables were visually read and what remains outside this pass."
  }
}
```

Requirements: normally 4–6 original visuals per paper, including an architecture/method figure, an original quantitative table and an ablation or diagnostic visual/table. `kind` is `figure` or `table`; `section` is `mechanism`, `results`, or `ablation`. `crop` contains normalized PDF-page bounds [left, top, right, bottom]. Use exactly three walkthrough paragraphs and two reproduction checks. Claim kind is `source`, `author-claim`, `analysis`, or `open-question`. All evidence IDs must resolve in that paper's base report; add precise evidence entries there only when needed.

Before writing a visual's reading guide, cross-check claim-relevant arrow directions, branch inequalities, attention masks, stop-gradient symbols and other key markers against the corresponding caption, equations and algorithms. If the source figure conflicts with them, preserve the faithful crop and explicitly disclose the discrepancy in the guide or caution, citing both locations. Explain the mechanism using the formulation that can be verified, and identify anything unresolved. Never alter the original graphic or infer obscured content. Focus this check on markings that affect the scientific claims.

Before submission, check evidence-page coverage across the complete report, illustrated edition and title metadata. For every retained numerical, method, training, evaluation or reproducibility claim, identify all supporting PDF pages, render and actually view them, and include them in `visualAudit.inspectedPages`, even when they are not cropped. Include appendix pages for hardware counts/models, software versions and configuration details, plus source facts underlying analysis or proposed checks. The independent reviewer receives the declared pages and final crops; reading text chunks or citing a page in prose does not supply a missing page image. Preserve valid details by supplying their evidence pages; never delete correct claims merely to avoid review. This check supplements complete source reading and inspection of every final original crop.

Optional extensions:

```json
{
  "featuredResultTask": "Exact task string from an existing base-report result",
  "visualLimitations": {
    "kind": "analysis",
    "text": "Explain precisely which expected visuals or experiments the reviewed source lacks, or which material cannot be inspected, and how that limits this edition.",
    "evidenceIds": ["evidence supporting this source limitation"]
  }
}
```

`featuredResultTask` selects the overview's key result without changing its numbers or evaluation conditions. Omit it when there is no empirical result; the template preserves the pilots' selected tasks and otherwise uses the first recorded result when available. Never invent a result to fill the overview.

`visualLimitations` is appropriate for surveys, theoretical work, or explicitly partial source coverage. Its kind must be `source` or `analysis`, and its nonempty explanation must cite the actual source evidence. It can justify 1–3 visuals or the absence of a quantitative table, method/result figure or ablation. The maximum remains six. Explain every departure, not just that the source is a survey. A difficult crop, an unfinished reading or a desire to save time is not a source limitation. Keep the original ten editions unchanged. Three tutorial steps and two proposed checks must address the work actually read; a survey can motivate a consistency or evidence-comparison check without pretending to contain new experiments.

An illustrated edition requires at least one inspected original PDF crop. Abstract-only sources or resources without a usable PDF receive an honestly scoped base report and a private `illustration-unavailable` status with a source-grounded reason and evidence IDs. Do not create an empty illustrated JSON or fabricated visual. Source access and reading coverage remain separate from this illustration outcome.

For each accepted edition, add a verified title block to `data/illustrated-report-metadata.json`, keyed by paper ID: `{ "authors": "credits actually inspected", "sourceSha256": "primary source hash", "page": 1 }`. Include `affiliations` only when verified, as one nonempty string; separate multiple institutions with semicolons, not an array. Omit an optional metadata key entirely when its value cannot be verified or does not apply; do not supply an empty string, `null`, an empty array, or a placeholder such as "not stated". A nonempty `location` may identify an official resource heading in place of a PDF page; never invent a page or affiliation. The metadata hash must match the base report's first source. Keep this metadata with the base report, edition and assets as one validated completion bundle.

Render PDF pages at 180–220 DPI by default and crop without modifying the scientific graphic. For narrow tables or diagrams, render the original PDF at higher DPI so the final crop remains sharp when enlarged (aim for 900–1800 pixels wide); do not upscale a low-resolution raster as a substitute. Retain readable axis labels, legends, table headers and relevant footnotes. Exclude surrounding body prose and long captions. No recreated charts, invented numbers, image-generation substitutes, or screenshots of another report. The asset is a source excerpt; retain source attribution and exact page/figure/table location. Store raw PDFs and intermediate full pages outside the repo. Use final PNG assets only under `public/report-assets/<id>/`. Inspect the final crops with an image-view tool, not extraction alone.

The website should integrate visuals with explanations, essential equations, training/inference distinctions, comparisons, taxonomy, limitations and reproduction reasoning. Every scientific figure must have an accessible description, local enlargement, source attribution, reading instructions, conclusion and boundary. A gallery appended to a generic text note is insufficient. Keep all website prose in English.

## Pinned original HTML evidence (explicit source upgrade only)

When source-config.json includes htmlVisuals, use source-html.mjs --root . --show ID,ID to request the coordinator-rendered original images, rather than inventing PDF pages or starting a browser inside the writer sandbox. Read every primary text chunk; actually view every supporting HTML section and final original figure. Use only pinned original HTML/SVG/table fragments, exact anchors/character ranges, author dependencies and the disclosed wrapper. Keep original captions, legends, table headers and relevant footnotes. The historical site CSS can be unavailable while original figure content is present; disclose wrapper reflow and do not call the extraction a pixel-identical site capture or publisher PDF.

HTML visuals use htmlSource (the exact helper locator) and sourceRendering (the exact descriptor disclosure), with no page/crop fields. sourceUrl uses the real original HTML anchor. visualAudit.inspectedSections lists supporting-section IDs, htmlEvidence maps every base evidence ID to all required supporting sections, and notes records scope. Omit inspectedPages. metadata.location equals the real identitySectionId, with no invented page. Every claim across report/edition/metadata must be supplied as readable supporting images to a fresh independent reviewer; unavailable external media remains explicitly uninspected. The original helper and reviewer gates remain mandatory. A descriptor is structure/provenance only, never scientific approval.

### Explicit original raster and animation evidence

Only a coordinator-supplied `wam-original-html-media-evidence-v1` bundle permits the new media locators. Preserve both the original conceptual raster and the informative architecture; do not create extra figures to meet a count. With fewer than four originals, record source-grounded visual limitations. Copy every supplied locator, source label and exact per-item rendering disclosure. An `html-animation-derived-still` is a derived frame from pinned original animation data and explicitly selected component times; it is neither a historical screenshot nor evidence that the full animation/video was read. Preserve the original GIFs/JSON, source iframe and captions, while the coordinator's trusted offline wrapper executes only the pinned player. Use the supplied supporting sections for every retained claim, preserve different input/model/output rates and state-field names, and distinguish conceptual scaling diagrams from measured results. Never substitute a PDF page number, old static-HTML receipt, source JavaScript execution or a generated illustration. A fresh independent reviewer must truthfully assess every role and claim after independent pixel verification; runtime logs and hashes cannot approve scientific content.

### Exact OpenScene resource profile

Only the explicit `wam-openscene-original-html-gif-evidence-v1` bundle permits four verified HTML documents: README, Dataset Stats, Challenge2024, and Getting Started. Copy the ordered `source-config.json.verifiedHtmlSources` into report.sources and read every document-tagged text chunk. This is a benchmark/toolkit resource, not the OccNet or ViDAR paper. Inspect all twelve supporting captures and four distinct selected visuals: historical README comparison, Stats benchmark table, Fact Sheet, and an explicitly GIF-derived frame0 demonstration. Preserve all cells, units, complete code blocks, supplied future ego poses, nonreactive driving conditions, version/missing-frame and private-test restrictions. Four GTX3090 cards describe a documentation recipe, not a measured cost. Every evidence ID must cite its actual sourceId and map only to supporting captures from that document.

Copy the exact returned source label, locator, dimensions and rendering disclosure. A composited GIF frame0 at0ms in loop0 is shown at native960×540; the authored HTML img width996px is disclosed and not reproduced. Neither one still nor engineering hashes establish full-animation viewing; absent GT/prediction, class-color and flow legends remain unknown. Use resource-specific visual limitations, not invented method/ablation experiments. Public links are restricted to the four canonical source documents and exact same-commit original GIF. Keep signed/raw/private download URLs out of report prose and public artifacts. Whole raw HTML/Markdown and private supporting images remain source evidence; do not delete correct report details to evade coverage. Fresh full source/science reading, independent original rerender and a new independent reviewer are required.
