---
name: survey-site-publisher
description: Configure, validate and publish a generic academic survey website or resource repository on GitHub and GitHub Pages. Use for deployment, repository renames, custom domains, or a requested push; distinguish repository delivery from website publication.
---

# Survey Site Publisher

Resolve the intended checkout, remote, branch and public destination from the user and actual Git configuration. A fork must use its own repository coordinates, not its upstream's identity.

For a generated survey project, read `docs/MAINTAINING.md` and inspect `survey.config.json`, `astro.config.mjs` and `.github/workflows/pages.yml`. `repo` mode has no website workflow. Do not claim a Pages release for it.

## Prepare a reviewable release

1. Check Git changes and determine exactly which files belong to the requested work. Keep credentials out of configuration and commits.
2. Verify `repository.owner/name`, site origin and base. A project Pages deployment uses `/REPOSITORY/`; a user/organization site or custom root domain uses `/`. If a custom domain is requested, also configure the host's custom domain and DNS and supply `public/CNAME`; changing the source origin alone is insufficient.
3. Run dependency installation from the lockfile, data validation, Markdown generation, tests, type checks and the build as applicable. Inspect a local preview at the configured base, including home, paper library and detail links. Generated site output must not contain local filesystem paths or environment secrets.
4. Commit and push only to the intended remote/branch when requested. Reconcile remote changes without force-pushing over another contributor's work.
5. If publication is requested, use the repository's actual Pages workflow. The bundled workflow is manual; GitHub Pages must be configured to use GitHub Actions. Dispatch it against the reviewed branch/commit and verify its run and deployment URL before reporting success. Respect any explicit privacy requirement.

Report these states accurately: local files changed, commit created, pushed to remote, workflow completed, website deployed. A successful push or local build is not evidence of a public deployment. When a renamed repository changes the site base, check internal routes and explain the new URL.

This workflow does not retrieve or modify the project's literature as a side effect of publication.
