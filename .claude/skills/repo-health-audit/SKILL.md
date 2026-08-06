---
name: repo-health-audit
description: Tucsenberg-local Claude entry for whole-repo health audits, launch-readiness audits, and audit-framework questions. Reads the Tucsenberg audit profile first; does not vendor the full global audit bundle.
---

# Repo Health Audit

This is the Claude-local entrypoint for Tucsenberg audits. It is intentionally
thin: use the global Codex `repo-health-audit` method when that surface is
available, but always read this repo's profile first and ignore any global
`ai-smell-audit` starter/showcase repo profile.

Before auditing, read:

1. `.claude/skills/repo-health-audit/references/tucsenberg-audit-profile.md`
2. `AGENTS.md` or `CLAUDE.md`
3. the `.claude/rules/*.md` files for touched paths

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
