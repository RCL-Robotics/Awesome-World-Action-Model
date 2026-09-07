# 维护与发布

当前处于私有开发阶段：仓库保持私有，GitHub Pages 已关闭，部署工作流已停用。仅使用本地预览；必须获得仓库所有者明确同意后才能公开发布。

论文内容以 Notion 中的 **Awesome-World-Action-Model** 数据库为准。导出得到 `data/papers.json` 和 `data/meta.json`，网站与 README 共用这份数据。每次导出先经过校验、代码审查和合并；合并不会发布网站。

## 本地预览

使用 Node.js 22.12 或更新的 22.x 版本，并保留 `package-lock.json`：

```bash
npm ci
npm run dev
```

打开终端显示的网址。当前项目使用 `/Awesome-World-Action-Model/` 子路径，因此通常为：

```text
http://localhost:4321/Awesome-World-Action-Model/
```

提交前运行：

```bash
npm run check
npm test
npm run build
npm run preview
```

`preview` 用于检查 `dist/` 中的生产构建。请检查搜索、分类和月份筛选、论文详情，以及窄屏布局。预览服务只在本地运行。

## 日常论文更新

1. 查看 GitHub 的论文推荐或纠错 Issue，核对 arXiv 与作者提供的来源。
2. 在 Notion 更新论文及主次分类。社区提出的论文数据改动也应先落实到 Notion，避免下一次导出覆盖修订。
3. 使用下面的本地流程或 Actions 手动导出。
4. 审查新增、删除、分类变动以及生成的 README。确认后合并 PR；`main` 的更新仅更新私有仓库，不会触发部署。

`README.md` 由脚本生成，请勿直接维护其中的论文列表。变更 README 的固定文案或排版时，修改生成脚本，再运行 `npm run generate:readme`。

### 通过已登录的 Notion CLI 导出

本机安装并登录 `ntn` 后，在终端设置数据源 ID。这里需要 **data source ID**，而不是外层页面 ID；数据库容器 ID 与 data source ID 也可能不同。

```bash
export NOTION_DATA_SOURCE_ID='your-data-source-id'
npm run sync:notion -- --cli
npm run generate:readme
npm run check
npm test
npm run build
git diff -- data/papers.json data/meta.json README.md
```

也可用 `npm run sync:notion -- --cli --source your-data-source-id` 显式指定来源。CLI 使用本机现有登录状态，不需要将凭据复制进仓库或聊天。

同步脚本会拒绝空结果；若条目数比现有数据减少超过 20%，会停止写入。先核对 Notion 访问权限、过滤条件和数据源是否正确。只有确认删除符合预期时，才在本地加上 `--allow-large-decrease` 重试，再审核 diff。

### 通过 GitHub Actions 手动导出

仅需要在首次启用时配置：

1. 创建可读取目标数据库的 Notion integration，并在 Notion 中将数据库连接给该 integration。
2. 在仓库 **Settings → Secrets and variables → Actions → Secrets** 新建 `NOTION_API_TOKEN`，填写 integration token。
3. 在同页 **Variables** 新建 `NOTION_DATA_SOURCE_ID`，填写目标 data source ID。
4. 在 **Settings → Actions → General → Workflow permissions** 中允许 **Allow GitHub Actions to create and approve pull requests**。工作流只使用创建 PR 的能力；所需 `contents: write` 和 `pull-requests: write` 已按 job 声明。组织策略可能限制该开关。[GitHub 权限说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

token 直接填入 GitHub Secret 即可，无需交给助手，也不要写进源码、Issue、终端命令历史或提交文件。普通网站构建读取仓库数据，不需要 Notion 凭据。

进入 **Actions → Sync papers from Notion → Run workflow**，选择 `main`。工作流读取 Notion、生成 README、运行检查与构建；有变更时创建独立的 `automation/notion-sync-…` 分支和 PR，无变化则结束。它只支持手动运行，没有定时任务。

如果推送分支成功而创建 PR 失败，在该次运行的 Summary 中打开 compare 链接，手动创建 PR，或修复上述权限设置。再次导出前，先合并或关闭已有同步 PR，便于集中审查。

由 `GITHUB_TOKEN` 创建的 PR，其检查可能需要维护者在 PR 页面点击 **Approve workflows to run**。同步工作流已经执行检查、测试与构建，但合并前仍应检查 PR 当前状态。[GitHub 工作流触发说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

## 未来公开发布（当前关闭）

本项目仓库初始化时为私有仓库。GitHub Free 支持公开仓库的 Pages；私有仓库需要支持 Pages 的套餐，例如 GitHub Pro 或 Team。先检查仓库 **Settings → Pages** 中是否可启用。若当前套餐不支持，需要仓库所有者明确决定公开仓库、使用合适套餐或另选静态托管；本项目的脚本和工作流不会更改仓库可见性。[GitHub Pages 可用范围](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

以下步骤仅供未来获得仓库所有者明确公开授权后使用。私有仓库的 GitHub Pages 网站也可能是公开的，不能将仓库私有等同于网站私有。

1. 将网站代码、数据、锁文件和 `.github/workflows/` 合并到 `main`。
2. 打开 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 明确获得公开发布授权后，重新启用 **Actions → Deploy to GitHub Pages**，手动选择 `main`，并勾选 `publish_publicly`。默认不发布，也不再监听 `main` 推送。
4. 在部署完成的 job 或 **Settings → Pages** 打开实际发布地址。

当前没有公开站点。PR 检查只构建和测试；本地预览地址见上文。

部署由 GitHub 官方的 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages` actions 完成。构建 job 只有读取权限，部署 job 单独申请 `pages: write` 与 `id-token: write`；只发布 `main` 的构建产物。[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 仓库名、自定义域名与子路径

默认部署设置在 `astro.config.mjs`：

- `site` 对应 `https://beat-in-our-hearts.github.io`。
- `base` 对应 `/Awesome-World-Action-Model`，大小写应与仓库名称一致。

仓库更名或 fork 后，在发布前更新这两个设置及项目外部链接。如果改用自定义域名，按域名的实际部署位置调整 `site`，根域名部署通常将 `base` 设为 `/`，同时在 Pages 设置中配置域名与 DNS。然后重新构建，并实际打开详情页和静态资源，避免子路径造成 404。[Astro 的 GitHub Pages 配置说明](https://docs.astro.build/en/guides/deploy/github/)

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| Notion 返回未授权或找不到数据源 | 核对 integration 是否连接了数据库、token 是否有效、ID 是否属于 data source；CLI 模式检查当前登录账号。 |
| 同步因缺少必填字段或分类无效而停止 | 在 Notion 修正对应条目，再导出；不要绕过数据校验。 |
| `npm ci` 失败 | 确认 Node 版本、网络访问，以及 `package.json` 与锁文件是否一起提交。 |
| 原 Pages 地址返回 404 | 当前已关闭公开发布，这是预期状态；请使用本地预览。 |
| 首页正常，但详情或样式 404 | 检查 `astro.config.mjs` 的 `site` 与 `base`，重新构建发布。 |
| 同步已推送分支，但没有 PR | 打开该次 Actions Summary 的 compare 链接，检查 Actions 创建 PR 的权限。 |

Actions 版本依据各 action 官方说明选取：[`checkout`](https://github.com/actions/checkout)、[`setup-node`](https://github.com/actions/setup-node)、[Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。升级时连同 Node 版本及 `npm ci`、检查、测试、构建一起验证。
