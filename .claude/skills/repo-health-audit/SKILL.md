---
name: repo-health-audit
description: Local Claude entry for whole-repo health audits, launch-readiness audits, and audit-framework questions. Reads the site audit profile first; does not vendor the full global audit bundle.
---

# Repo Health Audit

This is the Claude-local entrypoint for site audits. It is intentionally
thin: use the global Codex `repo-health-audit` method when that surface is
available, but always read this repo's profile first and ignore unrelated
starter profiles.

Before auditing, read:

1. `.claude/skills/repo-health-audit/references/site-audit-profile.md`
2. `AGENTS.md` or `CLAUDE.md`
3. the `.claude/rules/*.md` files for touched paths
4. `docs/派生项目交接.md` when judging template or derived-site readiness

Default posture is read-only. Pin the exact audited SHA, separate local proof
from deployed proof, and report blocked external checks instead of guessing.

Minimum audit shape:

1. Preflight: clean worktree, target SHA, allowed write scope, and proof boundary.
2. Walk the three critical chains from the profile: product discovery, buyer
   inquiry, and release/deploy proof.
3. Check gates/tests against the behavior they claim to protect.
4. Normalize findings with severity, evidence, impact, root cause, fix, and
   verification needed.
5. Close with what was checked, not checked, blocked, and owner-deferred.

For a derived site, also confirm that inherited docs, rules, and project skills
describe the current repository rather than the source template. External
provider, domain, inbox, and Owner proof never transfers from the source site.
