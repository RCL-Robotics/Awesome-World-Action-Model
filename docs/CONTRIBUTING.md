# Contributing / 参与贡献

We welcome paper recommendations, metadata corrections, and improvements to the website. English and Chinese contributions are both welcome.

## Recommend or correct a paper

Search the catalog and existing issues first. Open a **Recommend a paper / 推荐论文** issue with the paper title, arXiv URL, primary category, and a short explanation of its relevance. Add an official code or project link when available.

For an existing entry, use **Correct an entry / 条目纠错** and include the paper URL, proposed correction, and supporting source. Prefer the original paper or the authors' project page.

Maintainers curate paper content in Notion, then export a validated catalog to GitHub. Paper-data changes proposed in a PR must also be reflected in Notion before the next export. The website and README are generated from the same data; editing the generated README paper list directly will not preserve your change.

请优先通过 Issue 推荐或纠错，并附 arXiv、作者项目页等依据。维护者在 Notion 确认修改后同步至 GitHub，确保下一次导出保留修订。

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
