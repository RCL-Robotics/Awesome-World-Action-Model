# Illustrated reading edition

The current pilot is limited to the ten IDs in `data/report-pilot.json`. Prepare the samples for user review; do not start the remaining catalog until the user approves them.

An illustrated edition complements the evidence record in `data/reports/<id>.json` and lives in `data/illustrated-reports/<id>.json`. Read the original source text and visually inspect the relevant PDF pages, then inspect every final crop. Never derive scientific content from a reference site's report. Do not execute paper code.

Use this exact shape (all fields required):

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

Requirements: 4–6 original visuals per paper, including an architecture/method figure, an original quantitative table and an ablation or diagnostic visual/table. `kind` is `figure` or `table`; `section` is `mechanism`, `results`, or `ablation`. `crop` contains normalized PDF-page bounds [left, top, right, bottom]. Use exactly three walkthrough paragraphs and two reproduction checks. Claim kind is `source`, `author-claim`, `analysis`, or `open-question`. All evidence IDs must resolve in that paper's base report; add precise evidence entries there only when needed.

Render PDF pages at 180–220 DPI by default and crop without modifying the scientific graphic. For narrow tables or diagrams, render the original PDF at higher DPI so the final crop remains sharp when enlarged (aim for 900–1800 pixels wide); do not upscale a low-resolution raster as a substitute. Retain readable axis labels, legends, table headers and relevant footnotes. Exclude surrounding body prose and long captions. No recreated charts, invented numbers, image-generation substitutes, or screenshots of another report. The asset is a source excerpt; retain source attribution and exact page/figure/table location. Store raw PDFs and intermediate full pages outside the repo. Use final PNG assets only under `public/report-assets/<id>/`. Inspect the final crops with an image-view tool, not extraction alone.

The website should integrate visuals with explanations, essential equations, training/inference distinctions, comparisons, taxonomy, limitations and reproduction reasoning. Every scientific figure must have an accessible description, local enlargement, source attribution, reading instructions, conclusion and boundary. A gallery appended to a generic text note is insufficient. Keep all website prose in English.
