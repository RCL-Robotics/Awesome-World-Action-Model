# Contributing

We welcome paper recommendations, metadata corrections, and improvements to the website. Please write contribution descriptions in English.

The repository is private and the website is available through local preview only. GitHub Issues and pull requests require repository access; public hosting and automatic deployment remain disabled.

## Recommend or correct a paper

Search the catalog and existing issues first. Open a **Recommend a paper** issue with the paper title, authors, and a source URL that identifies the paper. Sources may include arXiv, DOI links, publisher pages, or paper PDFs. Add a suggested major category, subcategories, explanation of relevance, and official code or project links when available.

For an existing entry, use **Correct an entry** and include the paper URL, proposed correction, and supporting source. Prefer the original paper or the authors' project page.

Maintainers curate paper content in Notion, then export a validated catalog to GitHub. Paper-data changes proposed in a PR must also be reflected in Notion before the next export. The website and README are generated from the same data; editing the generated README paper list directly will not preserve your change.

The catalog now has six major categories with subcategories, plus an architecture × prediction-paradigm view. Q1–Q4 combine One Model or Dual-system architecture with Joint prediction or IDM; Outside quadrants, Not applicable, and Pending verification are kept as separate states. The nine original research directions remain available as an independent topic view. `Uncategorized` means the original Primary Category is not recorded; an entry can still have a complete major category and quadrant classification.

The export reads the entire Notion data source without writing back to Notion or reclassifying records. It preserves the six taxonomy fields—major category, subcategories, architecture, prediction paradigm, quadrant, and classification status—alongside the original 19 catalog fields. Classification evidence, retrieval logs, internal Date records, and raw Notion metadata remain outside this export. For a classification correction, identify the field and provide the research source supporting the change; avoid copying internal audit records or private paths into an Issue.

A missing abstract, classification field, or submission date does not exclude a paper. Leave missing information empty and add it in Notion only after checking the source. Record a publication year only when it is explicitly provided in Notion; do not infer it from an identifier or URL. Existing PDF links, DOI URLs, and BibTeX can also be preserved.

English taxonomy labels are presented through the shared `taxonomyLabel()` function in `src/lib/taxonomy.mjs`. Do not replace the original Notion values in the catalog to translate the interface. Keep major-category, subcategory, and quadrant suggestions distinct from the original research-topic fields.

## Improve the website

1. Fork the repository and create a branch for your change.
2. Use Node.js 22.12 or a newer 22.x release, then run `npm ci` and `npm run dev`.
3. Keep the change focused. Check desktop and mobile views when changing layout, and include screenshots in the PR.
4. Run the checks below and describe the resulting behavior in your PR.

```bash
npm run check
npm test
npm run build
```

If the exported paper data or README generator changes, also run `npm run generate:readme` and include the generated README. Preserve `package-lock.json` and commit it with dependency changes. No Notion token is needed to build the site or contribute website code.

Please check keyboard navigation, meaningful link labels, readable contrast, and the `/Awesome-World-Action-Model/` path when relevant. The PR workflow performs validation. Merging to `main` updates the private repository only; public hosting and automatic deployment are disabled.

For Notion export, local preview, and hosting restrictions, see [Maintenance and synchronization](MAINTAINING.md).
