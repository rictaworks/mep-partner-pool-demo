# Repository instructions

- Read requirements.md in full before feature work. Preserve its original bytes unless a requirements change is explicitly authorized.
- Implement F-01–F-09 through issues #3–#9 in dependency order under the latest user authorization. The latest multi-issue request supersedes the old setup-only / single-issue work policy; keep requirements.md byte-for-byte unchanged.
- Keep src/core pure and deterministic, with no HTTP, UI, database, environment, clock, randomness, or external-package dependencies. Keep frontend and backend adapters separate.
- All future persisted data access except the region master must enforce verified cookie-session ownership, including joins and related IDs. No data route may bypass ownership. See docs/architecture.md.
- Do not add external API or AI dependencies, real credentials, fabricated working features, or legal-compliance claims.
- Run npm ci and npm run check for meaningful changes. Add feature tests as implementation proceeds; scaffold tests do not prove session isolation or matching correctness.
- Build backend only with the configured Wrangler dry run. The current task authorizes issue branches, draft PRs, review, CI and squash merge; Cloudflare resource creation, deployment and publication remain prohibited.
- Shared setup rules were selected from rictaworks/context at commit 8f1ed19bd075c89a3f445141ba8123591d895b92. Read WORK/1/rule-selection.md for exact files, applicability, conflicts, and gaps before changing this project.
- Use red → implementation → green for subsequent feature work. Run ordinary review then security review before committing; use npm run hooks:install for local supplemental guards. Never claim the guards replace review.
- PR title/body and browser-only acceptance instructions must be Japanese; identify Codex (GPT-6) in the footer. Keep the setup PR draft and the setup issue open.
