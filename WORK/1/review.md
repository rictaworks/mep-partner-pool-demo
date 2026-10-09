# Setup review — issue #1

Date: 2026-10-10 JST. Reviewer: Codex (GPT-6), author self-review, not an independent Claude/Sonnet review.

## Ordinary review

Checked the source, tooling, tests, configuration, and documentation against setup issue #1 and the original requirements. The only implemented server behavior is setup status and explicit 501/404 responses. No domain feature is represented as complete. Browser/Worker/core type environments are separated; no runtime dependency is added. The future core is deliberately empty. Architecture tests and lint are supporting guardrails, not a proof of purity. Requirements bytes and checksum remain unchanged.

Corrected after shared-rule review: added the rule selection record, issue dependency/edit scope, local commit/merge guards, environment records, Japanese PR instructions, and a CI command timeout. Selected supported ESLint 10 after the registry marked ESLint 9 unsupported. TypeScript 5.9.3 stays within typescript-eslint's declared supported range; dependencies are pinned by lockfile.

## Security review

Result: **no material security issue found in the setup scope**.

Reviewed the absence of data access, request-body processing, external fetches, credentials, user-supplied HTML, cookies, module-level session state, D1 bindings, cron handlers, and deployment jobs. Unknown feature routes fail explicitly. CI permissions are read-only and checkout does not persist credentials. Secret and override filenames are ignored; staged contents receive a narrow supplementary pre-commit check. No legal-compliance claim is added.

Session isolation, mutation-origin protections, honeypot behavior, SQL ownership, assignment transactions, reset behavior, production routing, and actual feature security are **not implemented or validated**. They remain part of the single feature implementation issue. The local merge hook does not enforce GitHub reviews or prevent every Git merge mode. No branch protection or cloud configuration was changed.

## Validation

- Install: `npm ci` succeeded (Node 24.19.0, npm 11.9.0; temporary npm cache used for environment permissions).
- Lint: `npm run lint` succeeded.
- Typecheck: `npm run typecheck` succeeded for core/frontend/backend/tools.
- Test: `npm test` succeeded: 2 files, 11 tests.
- Build: `npm run build` succeeded; static frontend plus Wrangler `deploy --dry-run`, no bindings.
- Dependencies: `npm audit --audit-level=high` reported zero vulnerabilities at review time.
- Runtime: local Wrangler and Vite started; HTTP requests confirmed the setup page, proxied health JSON, and POST 501. `npm run smoke` provides repeatable assertions against these servers.
- Integrity: requirements.md = 21,184 bytes, SHA-256 `89ad526d468315e1e009037fe57b2d572ba2d03d9beb46a7961d7ab48d568fd6`.
- Browser/Claude Desktop acceptance, independent reviewer/pr-checker, and live deployment: not performed. CI results will be recorded on the draft PR after push.

No merge, publication, cloud resource creation, or credential setup is authorized by this review.

Additional UI review: verified the existing electricity-plan-advisor-demo layout at commit 6dc69eed5dfd3719bf287ebe2c3d61ecdb98bfa5. Added static demo-list/contact links with no scripts or imported tracking ID. Contact opens with noopener/noreferrer. GA4 remains absent because the common UI preference conflicts with this project's no-measurement requirement; user decision is pending. No production reset behavior is implied by the setup banner.
