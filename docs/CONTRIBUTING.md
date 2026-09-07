# Contributing / 参与贡献

We welcome paper recommendations, metadata corrections, and improvements to the website. English and Chinese contributions are both welcome.

The repository is private and the website is available through local preview only. GitHub Issues and pull requests require repository access; public hosting and automatic deployment remain disabled.

## Recommend or correct a paper

Search the catalog and existing issues first. Open a **Recommend a paper / 推荐论文** issue with the paper title, authors, and a source URL that identifies the paper. Sources may include arXiv, DOI links, publisher pages, or paper PDFs. Add a suggested category, explanation of relevance, and official code or project links when available.

For an existing entry, use **Correct an entry / 条目纠错** and include the paper URL, proposed correction, and supporting source. Prefer the original paper or the authors' project page.

Maintainers curate paper content in Notion, then export a validated catalog to GitHub. Paper-data changes proposed in a PR must also be reflected in Notion before the next export. The website and README are generated from the same data; editing the generated README paper list directly will not preserve your change.

The export reads the entire Notion data source without writing back to Notion. A missing abstract, category, or submission date does not exclude a paper. Missing primary categories are kept as `Uncategorized`, an editing queue alongside the nine research directions. Leave missing information empty and add it in Notion only after checking the source. Record a publication year only when it is explicitly provided in Notion; do not infer it from an identifier or URL. Existing PDF links, DOI URLs, and BibTeX can also be preserved.

请通过有访问权限的仓库 Issue 推荐或纠错，填写标题、作者和论文来源 URL，并附 DOI、出版方论文页、PDF 或作者项目页等依据。摘要、分类和提交日期可暂缺，维护者会保留条目并在 Notion 核对补充；不要为了通过同步而编造信息。

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

For Notion export and deployment instructions, see [维护与发布](MAINTAINING.md).
