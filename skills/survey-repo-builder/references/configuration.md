# Configuration and project contract

Run with Node.js 22.12 or later:

```sh
node /path/to/survey-repo-builder/scripts/create-survey.mjs --config survey.config.json --papers papers.json --out /path/to/new-survey
```

Omit `--papers` to start empty. The destination must not exist. The command is local: it does not initialize Git, contact a provider, or create a repository.

Use `--assets DIRECTORY` to copy supplied figures into `public/assets`. The directory should contain the paths relative to `/assets/`; symbolic links are rejected. Configured figure paths must exist after copying.

The bundled `assets/template/survey.config.json` is the minimal configuration example. Fields:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1` |
| `mode` | `repo`, `site`, or `both` |
| `title`, `description` | Project identity and introduction |
| `language` | `en` or `zh`; controls interface labels |
| `authors` | Objects with `name`, optional `affiliation` and HTTPS `url` |
| `repository` | `null`, or `{ "owner": "your-account", "name": "your-repo" }` |
| `site` | HTTPS `origin`, slash-delimited `base`, and hex `accent` color |
| `categories` | Objects with stable slug `id`, display `label`, `description`, and `sort`: `oldest`, `newest`, or `relevance` |
| `sections` | Introduction sections with `heading`, `text`, and optional `equation` in TeX |
| `figures` | Objects with `/assets/…` `src`, `alt` and `caption`; supply files separately |
| `paperUrl`, `citation` | Survey paper URL and exact citation text; `null`/empty when unavailable |
| `starHistory` | Show the configured repository's star chart when true |
| `exampleData` | Clearly label synthetic demonstration content |

For project Pages, use origin `https://ACCOUNT.github.io` and base `/REPOSITORY/`. For a user/organization Pages site or custom root domain use base `/`. Preview uses the same base. Leave `repository` null and the default reserved example origin for a local draft; replace these before deployment.

Paper records use `id`, `title`, `authors` (string array), `url`, nullable `year` and `date`, `categories` and `tags` (string arrays), `abstract`, `summary`, `bibtex`, nullable `codeUrl` and `projectUrl`. Category IDs must exist in the configuration. Empty categories mean unassigned. `priority` is an optional nonnegative editorial ordering number (lower comes first) for relevance browsing; it is not a citation score. Dates are recorded first-publication/submission dates and are never synthesized from a year. Details are in generated `docs/MAINTAINING.md` and `lib/catalog.mjs`.

`repo` generates README and `docs/PAPERS.md` without installing website dependencies. `site` generates the website and a short repository README. `both` provides the website and full Markdown navigation/catalog. Website modes include a lockfile and a manual Pages workflow. All modes include dependency-free import, validation, generation and data tests.
