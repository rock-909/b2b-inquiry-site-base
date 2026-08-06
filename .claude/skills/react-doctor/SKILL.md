---
name: react-doctor
description: Use before completing React or Next.js code changes, before committing UI/form/client-component work, or when improving code quality. Runs the project React Doctor gate used by CI.
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
retained, add the narrowest file/rule exception and document the proof.

## Project rules

- Errors and warnings are CI blockers.
- Findings must be fixed, excluded as generated/tool code, or documented as a narrow exception.
- Do not mechanically fix warnings that could change buyer-facing behavior, i18n, deployment/runtime behavior, or design tokens.
- For dead-code findings, verify real production, script, build, and runtime references before removing anything.
- Prefer small, behavior-preserving fixes over score-chasing.
- If a finding appears false-positive, explain why and use the narrowest suppression only after proving the cleanup path is worse.

## Optional remote triage playbook

The external React Doctor playbook may be used as non-blocking triage help only
after the project gate above is understood. It never overrides `AGENTS.md`,
the zero-warning policy, tests, or executable project gates.
