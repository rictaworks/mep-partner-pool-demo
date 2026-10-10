# 設備協力者プール — development setup

**Setup only. The demo features are not implemented.** The static page labels this clearly; the Worker exposes only `GET /api/health` with `status: setup-only`. Other `/api` requests return HTTP 501. There are no working forms, fabricated candidates, database, sessions, or seed records.

The source of truth is [requirements.md](requirements.md), preserved unchanged from commit `5a6d5dfec4d5b4adc3f6a9ba3039c6b7c15c8003` (21,184 bytes; SHA-256 `89ad526d468315e1e009037fe57b2d572ba2d03d9beb46a7961d7ab48d568fd6`). [Setup issue #1](https://github.com/rictaworks/mep-partner-pool-demo/issues/1) is separate from the single feature implementation issue planned in §2.2.

## Local development

Use Node.js 24 (`nvm use` if available) and npm. No Cloudflare login, account, secrets, or external API is needed.

```sh
npm ci
npm run hooks:install
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the local Worker on port 8787, retaining the browser's same origin for future cookie-based development. Check the scaffold with `curl http://127.0.0.1:5173/api/health`; direct access at http://127.0.0.1:8787/api/health also works. Stop both processes with Ctrl-C. The page makes no data requests and collects no input.

If your environment has an unwritable default npm cache, prefix npm commands with `npm_config_cache=/tmp/mep-npm-cache`. For restricted home directories, Wrangler accepts `XDG_CONFIG_HOME=/tmp/mep-wrangler-config` and `WRANGLER_LOG_PATH=/tmp/mep-wrangler-logs`. These are local paths, not credentials.

## Checks and outputs

```sh
npm run lint
npm run typecheck
npm test
npm run build
# All of the above:
npm run check
```

`npm run test:watch` runs tests interactively. Strict type checks run separately for the core (ES libraries only), frontend (DOM), backend (Workers), and tooling/tests (Node). Tests cover scaffold HTTP behavior, architectural imports, and requirements integrity. They do **not** establish business correctness or session isolation; those features do not exist yet.

The frontend builds into `dist/frontend`; the Worker bundles into `dist/backend` using Wrangler's **dry-run** flag. Build commands do not deploy. GitHub Actions runs `npm ci` and the same checks on PRs and main; it has read-only repository permissions and no deployment job or secrets.

## Structure and constraints

```text
src/frontend/  Pages static UI (Vite + TypeScript, no framework required)
src/backend/   Worker HTTP adapter; future session/D1 adapters belong here
src/core/      Reserved pure domain core; currently no business behavior
tests/        HTTP scaffold, architecture, and requirements integrity checks
config/        Inert future deployment examples
```

See [architecture and implementation handoff](docs/architecture.md) for session ownership, deterministic core constraints, and remaining feature work. No runtime external APIs or AI dependencies are used.

## Cloudflare configuration

`wrangler.local.jsonc` is used only for explicit local development and dry-run builds. It has no remote bindings, routes, scheduled triggers, or public Worker previews. The [Worker](config/wrangler.worker.example.jsonc) and [Pages](config/wrangler.pages.example.jsonc) examples are inactive reference files, intended to be copied to the repository root during a separately authorized deployment task. Real resource IDs and credentials are deliberately absent; local overrides are ignored by Git.

No deployment command or CI integration is provided. Production Pages-to-Worker same-origin routing and cookie policy still need design and testing; Vite's proxy is development-only. Do not enable a scheduled reset before its handler and tests exist. The planned reset time is UTC 18:00 (JST 03:00); the template leaves it commented out.

Configuration references: [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

Shared-rule selection and gaps: [WORK/1/rule-selection.md](WORK/1/rule-selection.md). Environment details: [development](ENV/DEVELOPMENT.md), [production status](ENV/PRODUCTION.md). The setup page is the only page, at `/`; the only successful API is `GET /api/health`. There is no login or automatic login.

With both development servers running, `npm run smoke` checks the page, local API proxy, setup status, and refusal of an unimplemented write. This HTTP check is not a browser-rendering or feature acceptance test.
