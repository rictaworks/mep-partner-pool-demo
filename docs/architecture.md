# Implementation handoff

Issues #3–#9 implement F-01–F-09 in dependency order under the current user request, superseding the historical setup-only/single-issue work policy. requirements.md remains byte-for-byte unchanged. Issue #3 establishes shared types, strict input validation, region data and the API contract; it does not claim later routes are implemented.

## Pure domain core

`src/core` receives validated, explicit values and returns deterministic results. It must not read cookies, HTTP requests, environment variables, databases, the filesystem, the current time, or randomness. Supply necessary dates/IDs as explicit inputs. The independent core TypeScript project has no DOM, Node, or Worker ambient types; architecture tests restrict core imports to core files. Lint also rejects common clock, random, and I/O globals. These checks support architectural review; they are not a proof of purity.

Backend adapters load session-owned values, call the core, and serialize results. Frontend modules must not import backend modules, or vice versa. Keep transport, persistence, and domain types separate when their responsibilities differ.

## Session ownership before data routes

Persistence endpoints must follow these ownership rules:

- Generate and validate a server-issued opaque cookie session; never accept ownership from a request body or query parameter. Define HttpOnly, Secure, SameSite, expiry, and mutation-origin protections for the chosen same-origin deployment.
- Every table except REGION_MASTER carries `session_id`, including join tables. Every read, write, join, update, and deletion must be scoped to the verified session. Validate ownership of all referenced entities; use composite ownership constraints where appropriate.
- Keep session/request state out of Worker module globals. Repository methods should require the verified owner explicitly, with no unscoped data-access fallback.
- Ensure assignment revalidation and its writes are atomic to prevent stale or concurrent over-allocation; cancellation must restore only the owner's engagements.
- Test two independent cookie jars attempting each other's IDs and relationships, including assignments, cancellations, edits, deletions, and concurrent requests.
- Treat the scheduled global reset as an explicit maintenance operation, never a public HTTP endpoint. Preserve REGION_MASTER and test reset/seed lifecycle separately.

## Remaining feature implementation

The dependent implementation issues cover the full specification, including:

1. D1 migrations, session-scoped repository adapters, region master (70 entries), fictional seed data (10 partners / 3 projects), and initial-session lifecycle.
2. Partner, engagement, and project CRUD; input validation, honeypot handling, and personal-name avoidance notes.
3. Pure matching: derived requirements, all exclusion reasons, single/pair candidates, deterministic ranking, top-20 pair limit, and one-/two-condition relaxation suggestions.
4. Assignment revalidation, atomic persistence, cancellation, and workload consistency.
5. All specified screens and explicit derived-condition explanations; no fabricated behavior as placeholders.
6. Scheduled reset at UTC 18:00, plus integration and browser tests.

Domain tests must include 3-floor and 5,000 m² boundaries, inclusive date overlap, zero capacity, same-office pair rejection, field-specific pair qualifications, deterministic ties, and non-relaxable constraints. The simplified qualification rule is a demo rule from the specification; do not represent results as legal-compliance assurance.

The user authorizes reviewed issue PRs and merge. Cloudflare resource creation, live deployment and publication remain prohibited. No cloud resources are created by implementation checks.

## Shared values

`src/core/types.ts` defines unique readonly array sets, Japanese enum values, calendar date strings and camelCase domain values. Pure validators consume unknown and return structured validation errors without IO. They reject unknown properties, invalid or repeated set members, unsafe counts and invalid calendar dates without consulting the clock. `src/core/regions.ts` owns the 70-entry master and whole-prefecture expansion. Domain snapshots add numeric IDs and optimistic revisions; HTTP adapters strip transport-only honeypot/revision inputs before validating domain inputs. `src/backend/contracts.ts` owns HTTP wrappers and the verified owner brand. Later issues use these contracts as reference-only shared interfaces. The detailed same-origin, cancellation, partial assignment and concurrency obligations are in docs/api.md.
