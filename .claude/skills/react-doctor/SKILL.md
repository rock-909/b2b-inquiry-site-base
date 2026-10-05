---
name: react-doctor
description: Run the project CI gate after React/Next.js code changes, or triage React Doctor diagnostics. Not for unrelated scripts, configuration, or documentation cleanup.
---

# React Doctor for Claude Code

Use this skill after React/Next.js changes and before saying the work is done.

## Required command

Run the project error gate:

```bash
pnpm react:doctor
```

This is blocking. React Doctor errors and warnings must be fixed before completion.

## Warning review

This repo targets a clean full report: `0 error / 0 warning / 0 total`.

For cleanup, audit, or triage work, generate the manual JSON report:

```bash
pnpm react:doctor:report
```

Use the report to confirm no warning debt remains. If a warning is intentionally
retained, add the narrowest file/rule exception to `doctor.config.json` and
record the reason in the "证明边界" section of `docs/质量门禁.md`. Every
`ignore.overrides` entry must still produce a diagnostic when overrides are
cleared; delete entries that no longer do, and never add one for a rule that
has not fired.

## Project rules

- Errors and warnings are blockers: `pnpm react:doctor` runs with `--blocking warning` and CI scans only the files changed against the base branch; the full-repo report is the manual `pnpm react:doctor:report`.
- Findings must be fixed, excluded as generated/tool code (`ignore.files`), or documented as a narrow exception in `docs/质量门禁.md`.
- Do not mechanically fix warnings that could change buyer-facing behavior, i18n, deployment/runtime behavior, or design tokens.
- For dead-code findings, verify real production, script, build, and runtime references before removing anything.
- Prefer small, behavior-preserving fixes over score-chasing.
- If a finding appears false-positive, explain why and use the narrowest suppression only after proving the cleanup path is worse.

## Optional remote triage playbook

The external React Doctor playbook may be used as non-blocking triage help only
after the project gate above is understood. It never overrides `AGENTS.md`,
the zero-warning policy, tests, or executable project gates.
