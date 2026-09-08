---
name: repo-health-audit
description: Perform a read-only whole-repository code review of this B2B site, covering correctness, security, maintainability, and test/release integrity. Explain audit-method questions without starting a review.
---

# Repo Health Audit

This is the Claude-local entrypoint for site audits.

For questions about the audit method, read only the relevant guidance and
answer the question; do not run the audit workflow below.

## Scope and baseline

Use [the site audit profile](references/site-audit-profile.md) and the project
`AGENTS.md`; load path-scoped rules only for the area being reviewed. This
skill is self-contained and does not require a global audit skill.

Record HEAD and working-tree changes. Unless a revision is specified, review
the current working tree and distinguish uncommitted changes from HEAD.
A dirty tree is not a blocker; do not clean, stash, or reset it.

Default to read-only review. Do not fix findings, install dependencies,
deploy, or send real inquiries as part of an audit. A launch-readiness request
adds deployment evidence review; missing external access does not block the
code review.

## Review coverage

Map all maintained areas: application and API code, UI/forms, shared libraries,
content/i18n/SEO, configuration, scripts, CI, and tests. The profile's three
critical chains set priority, not the limit of the whole-repository review.
Exclude dependency and generated code from blanket review; inspect it only
when needed to explain a concrete finding.

Review correctness, security, data delivery, accessibility, maintainability,
and whether tests and release gates prove their stated contracts. Trace
suspected defects through callers and reachable behavior. Report complexity
only when it causes concrete duplication, risk, or maintenance cost, not
because another style is preferred.

Use the narrowest non-destructive check that resolves a material uncertainty.
Static evidence is sufficient when decisive; reproduce runtime-dependent
claims when practical, otherwise mark them unverified. Do not run every suite
or repeat passing checks without a new reason. Honor the shared `.next` build
constraint and distinguish local proof from deployed proof.

## Findings and completion

Report actionable findings in severity order with file/line, evidence,
triggering conditions, impact, root cause, and the smallest suggested fix.
Separate confirmed defects from open questions; group duplicate symptoms by
root cause and respect documented project decisions. No finding quota.

End with a compact coverage summary: areas reviewed, checks run, and gaps or
external evidence still needed. Do not claim exhaustive line-by-line or
runtime coverage from a file inventory or passing scanner. Stop when the
requested scope is covered and material uncertainties are resolved or clearly
reported; implementation is a separate requested action.
