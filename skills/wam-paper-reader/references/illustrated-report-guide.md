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

Include every inspected PDF page needed to verify numerical or method details in a visual's reading guide, takeaway or caution in `visualAudit.inspectedPages`, even when that page is not cropped. For example, if a guide explains a training coefficient given on a later methods page, inspect and declare that page too. The independent visual reviewer receives the declared source pages and final crops; a prose evidence entry alone does not supply the missing page.

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

For each accepted edition, add a verified title block to `data/illustrated-report-metadata.json`, keyed by paper ID: `{ "authors": "credits actually inspected", "sourceSha256": "primary source hash", "page": 1 }`. Include `affiliations` only when verified. A nonempty `location` may identify an official resource heading in place of a PDF page; never invent a page or affiliation. The metadata hash must match the base report's first source. Keep this metadata with the base report, edition and assets as one validated completion bundle.

Render PDF pages at 180–220 DPI by default and crop without modifying the scientific graphic. For narrow tables or diagrams, render the original PDF at higher DPI so the final crop remains sharp when enlarged (aim for 900–1800 pixels wide); do not upscale a low-resolution raster as a substitute. Retain readable axis labels, legends, table headers and relevant footnotes. Exclude surrounding body prose and long captions. No recreated charts, invented numbers, image-generation substitutes, or screenshots of another report. The asset is a source excerpt; retain source attribution and exact page/figure/table location. Store raw PDFs and intermediate full pages outside the repo. Use final PNG assets only under `public/report-assets/<id>/`. Inspect the final crops with an image-view tool, not extraction alone.

The website should integrate visuals with explanations, essential equations, training/inference distinctions, comparisons, taxonomy, limitations and reproduction reasoning. Every scientific figure must have an accessible description, local enlargement, source attribution, reading instructions, conclusion and boundary. A gallery appended to a generic text note is insufficient. Keep all website prose in English.
