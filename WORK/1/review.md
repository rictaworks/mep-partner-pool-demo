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
- Initial validation did not include browser rendering or independent review; see the follow-up sections below. Claude Desktop acceptance and live deployment remain unperformed. Hosted CI results are recorded on the draft PR.

No merge, publication, cloud resource creation, or credential setup is authorized by this review.

Additional UI review: verified the existing electricity-plan-advisor-demo layout at commit 6dc69eed5dfd3719bf287ebe2c3d61ecdb98bfa5. Added static demo-list/contact links with no scripts or imported tracking ID. Contact opens with noopener/noreferrer. GA4 remains absent because the common UI preference conflicts with this project's no-measurement requirement; user decision is pending. No production reset behavior is implied by the setup banner.

## Independent ordinary review and browser rendering follow-up

Reviewed source head: `3532e68b5bbd812de99aeaee823105b39081cb99`.

An independent Codex reviewer (`ordinary_review`, separate agent from the author) read the full requirements and all changed source, tests, configuration, documentation, hooks, and CI. Result: **no actionable setup-scope correctness, maintainability, test-quality, or scope defects found**. The reviewer independently passed lint, four typechecks, 11 tests, frontend build, and Worker dry-run. The latter required the already-documented XDG/log-path overrides because this execution environment cannot write the default home configuration directory. This was not a Claude/Sonnet review.

The author then rendered the actual development page in Chromium 151.0.7922.173 using the browser's DevTools protocol. Desktop 1280×900 and mobile emulation 390×844 both displayed the Japanese setup notice, readable text, and both navigation links without horizontal overflow. Tab focused the demo-list link with a visible outline. There were no JavaScript runtime exceptions, forms, fabricated feature controls, `gtag`, or Google Analytics/Tag Manager requests. Network requests during page rendering stayed on the local Vite origin. External destinations were checked by DOM URL, not by navigating to those sites.

Screenshots inspected visually: [desktop](screenshots/desktop.png), [mobile](screenshots/mobile.png). This is real **headless Chromium** rendering, not a GUI desktop session or Claude Desktop sandbox>chrome acceptance test. It does not validate unimplemented application behavior or certify accessibility. Both checks used the existing local Vite/Worker processes from setup; attempts to start duplicate servers correctly encountered occupied ports.

## Independent security review follow-up

After ordinary review, a second independent Codex reviewer (`security_review`) examined head `3532e68b5bbd812de99aeaee823105b39081cb99`, including source, configuration, scripts, CI, and the selected rules. Result: **no actionable setup-scope security defects found**. No implementation fix was needed.

The reviewer confirmed static external links only and no GA4; checked the absence of user-data processing, credentials, remote bindings, deployment jobs, and module-level session state; and verified that lockfile resolutions use HTTPS registry.npmjs.org URLs with integrity values. Independent `npm audit --json` reported zero vulnerabilities across development/production dependencies, and all 11 tests passed. The supplemental security command passed with an empty index; that run is explicitly **not** evidence of historical secret scanning.

This review is limited to the current setup surface. It does not establish session isolation, future D1 query safety, business-logic correctness, or deployment readiness. Both independent reviewers were Codex agents, not the Claude/Sonnet models named in the shared reference. No high/medium/low actionable findings remained. The subsequent changes only record these reviews and add browser screenshots; application code/configuration remains identical to the reviewed head.
