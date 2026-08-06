---
name: intent-review
description: "The last judgement before a PR is merged: does this change actually do what it was supposed to do, and is it safe to ship. Reconstructs the requirement behind the PR, then checks the merge diff against it — what the requirement asked for and the code does not do, what the code does that nobody asked for, whether it solves the problem the way this project solves problems, and what can still break (security, reliability, contracts, hollow tests) even when the requirement is met. Produces the requirement table the owner reads to decide whether to merge. Use when the user asks whether a PR is ready to merge, whether it meets its requirement, whether a change is doing the right thing, or asks for a PR review, security review, or pre-merge judgement. Not a gate — pre-push hooks and CI already cover build, lint, and tests."
---

# Intent Review

Gates answer *does it work*. Task-level reviews answer *is this task correct*.
Neither answers *does the whole thing do what was asked* — that is this skill's
only job, and it runs once, at the point where that question actually gets
decided: **after CI is green, before the owner merges.**

Read the change the way an experienced engineer reads a colleague's PR: figure
out what it was supposed to accomplish, then check whether the code accomplishes
that, only that, and in a way that fits this codebase.

## Position in the Workflow

Run this after the branch is pushed and CI has reported, not before. Two reasons:

- The merge diff (`git diff origin/main...HEAD`) is the thing actually being
  merged. Reviewing the working tree earlier reviews something that will still
  change.
- Upstream reviews are per-task and blind to each other. Three tasks can each
  pass their own review while the assembled result drifts from the approved
  design. That drift is only visible against the full merge diff.

**Scope is always the merge diff** unless the user names something narrower:

```bash
git diff origin/main...HEAD          # what merging would actually apply
gh pr view --json title,body         # the requirement, as stated
gh pr checks                         # CI result — read it, do not re-run it
```

Do not run build, lint, or test gates. `lefthook` pre-push and
`.github/workflows/ci.yml` already own that; re-running them buries the
judgement under output nobody reads twice. **Read** the CI result instead. If CI
is red, say so in one line and stop — a change that does not build is not ready
for a judgement about intent.

For a whole-repo audit, launch-readiness audit, or audit-framework question, use
the project-local `repo-health-audit` skill. This project keeps `intent-review`
as the owner-facing pre-merge judgement, not as a second audit framework.

This skill is read-only. It never edits files and never applies fixes.

## Step 1: Reconstruct the Requirement

Everything downstream depends on this being right. Do not rush it, and do not
invent it.

Gather, in this order of authority:

1. What the user said in this conversation — the most current statement of intent
2. The design spec and implementation plan, if this work went through
   `superpowers:brainstorming` and `superpowers:writing-plans` — the owner already
   approved that spec, so it is the requirement of record and needs no
   reconstruction, only reading. If it has an "Acceptance Scenarios" section,
   use those scenarios as the checkable behavior source.
3. The PR description and linked issue (`gh pr view`, `gh issue view`)
4. Commit messages on the branch
5. The diff itself — weakest source, since it shows what was built, not what was asked

When a spec exists, this step is cheap and the review's weight falls on Step 2.
When there is no spec — the common case for small changes — this step *is* the
review's value, and it is worth spending real effort on.

Then write the requirement down as **checkable statements**, not a paragraph.
Each one must be something the code can be held against:

- Good: "The RFQ form reserves its height so the page does not shift while the inquiry panel loads."
- Bad: "Improve the form experience."

State which source each statement came from. Statements inferred from the diff
alone are marked as inferred — the weakest kind, because a diff inferred as its
own requirement always passes.

**If the requirement cannot be reconstructed, stop and ask.** A review against a
guessed requirement is worse than no review: it manufactures confidence. Say what
could not be determined and what would resolve it.

## Step 2: Read the Change Against the Requirement

Launch four read-only sub-agents in parallel, each with the same diff and the
same requirement statements. For a diff of one or two small files, do this inline
instead — four agents on a ten-line change is overhead, not rigor.

The four ask different questions, in this order of value: what the requirement
asked for and is missing, what nobody asked for, whether it fits how this repo
solves things, and what can still break even though the requirement is satisfied.

Every sub-agent: role `Explore` (read-only at the tool layer — no Edit, Write, or
NotebookEdit), findings only, each anchored to a file and line or it does not count.

### Sub-Agent 1: Coverage — what was asked for and is missing

For each requirement statement, find where the code implements it. Report:

1. Statements with no implementation anywhere in the diff
2. Statements implemented only on the happy path — the error, empty, loading, or
   no-JS path was left behind
3. Statements implemented in one place but not in the sibling places that share
   the behavior (other locales, other product pages, other form entry points)
4. Statements the code claims to satisfy but does not — read the actual logic, not
   the function name or the comment

A statement with no implementation is the highest-value finding this skill
produces. Look for it first.

### Sub-Agent 2: Scope — what nobody asked for

Report code in the diff that no requirement statement accounts for:

1. Behavior changes outside the stated problem
2. Refactors, renames, or reformatting bundled into a behavior change, making the
   real change hard to see and hard to revert
3. New abstractions, options, config, or flags with exactly one caller — built for
   a need nobody has stated
4. Dependencies added for something a few lines of existing code already do
5. Removed code whose removal the requirement never asked for

Not every extra is wrong — an unavoidable adjacent fix is fine. Say which it is:
justified by the requirement, harmless, or should be its own PR.

### Sub-Agent 3: Fit — whether it solves it the way this project solves things

A change can satisfy the requirement and still be wrong for this codebase.

1. **Root cause vs symptom.** Does it remove the condition that made the bug
   possible, or cover the symptom at one call site while sibling callers stay
   broken? Grep the other callers before answering.
2. **Existing means.** Is there already a helper, hook, constant, or pattern in
   this repo doing this? Re-implementing what lives two files over is the most
   common failure here.
3. **This repo's red lines** — each is a high-severity finding:
   - User-facing copy hardcoded instead of going through a translation key
   - Hand-edits to `src/lib/content-manifest.generated.ts` (regenerate it with
     `node scripts/starter-checks.js content-manifest`)
   - A gate or test asserting a point-in-time snapshot — commit hash, item count,
     push state — instead of the behavior the rule describes
   - A gate whose failure path is unreachable, or a test that cannot fail
   - Content assertions added to `AGENTS.md` / `CLAUDE.md` instead of guarding the
     behavior where it happens
   - Permanent deletion (`rm`, `git clean`, `find -delete`) instead of Trash
   - A Cloudflare / OpenNext change whose only verification was `pnpm build` —
     `pnpm website:build:cf` writes the same `.next` directory and must follow it
4. **Buyer-facing consequences.** This site exists to collect OEM and wholesale
   inquiries. A change reaching the RFQ form, product specs, PDF downloads, or
   page speed carries commercial risk, not just technical risk. Say so plainly.

### Sub-Agent 4: Risk — what still breaks even though the requirement is met

The first three ask whether the change matches the requirement. This one assumes
it does, and asks how it breaks anyway. A PR can satisfy every stated requirement
and still be unsafe to merge.

1. **Security and privacy.** Weakened or missing authn/authz on a touched path,
   unvalidated input crossing a trust boundary, injection surface, secrets or
   buyer PII reaching logs, error bodies, or client bundles, permissions widened
   by default. The RFQ pipeline (`/api/inquiry` → Turnstile → Airtable → Resend)
   is the highest-value target in this repo — treat any change there as
   trust-boundary work.
2. **Reliability.** Races and ordering assumptions, unhandled rejection paths,
   missing cleanup or cancellation, retry behavior that amplifies an outage,
   a failure mode that silently drops a buyer inquiry instead of surfacing it.
   Ask specifically: if this external call fails, what does the buyer see, and
   does the lead survive?
3. **Contracts.** API shape, schema, exported types, config keys, env vars, or
   message keys changed without their consumers; migrations without a
   backward-compatible path; a generated artifact whose source and output now
   disagree.
4. **Guards switched off.** Any `eslint-disable`, `@ts-expect-error`, `as any`,
   skipped test, or widened suppression the diff adds: ask what boundary makes
   the rule wrong here, and whether the same-line reason says it. No registry
   enforces this — it is a judgement call, and this is where it gets made.
5. **Proof quality.** CI being green is an input, not evidence that the new
   behavior is actually tested. Read the tests the PR adds or changes: does any
   of them assert the behavior the requirement names, and could it fail if the
   implementation were wrong? A test that mirrors the implementation's shape, or
   whose mocks stand in for the thing under test, is not coverage — report it as
   a gap even though CI passed.

**Loading the rules that apply.** Before reporting, read the `.claude/rules/*.md`
files that govern the paths this diff touches (`AGENTS.md` maps file types to
rule files). The red lines in Sub-Agent 3 are the recurring ones, not the
complete set — a change to API, caching, or Cloudflare config has rules of its
own that no hardcoded list here will cover.

## Step 3: Synthesize

Sub-agent output is raw input, not the answer. Merge and cut hard:

- Drop duplicates and anything without a file and line
- Drop style and readability notes unless they hide a real defect
- Drop findings that conflict with a requirement statement the user confirmed —
  the requirement wins, not the reviewer's taste
- Where a sub-agent may be right but the requirement is silent, convert it into an
  open question instead of a finding

## Step 4: Answer the Question That Was Asked

Lead with the verdict — the user asked whether this change does its job.

| Verdict | Means |
|---|---|
| **Meets it** | every requirement statement is implemented; nothing material is out of scope |
| **Partially meets it** | the main behavior is there, but specific statements are unimplemented or half-implemented — list exactly which |
| **Misses it** | the change does not solve the stated problem, solves a different one, or fixes a symptom while the cause stands |

Then, in this order:

1. **Requirement table** — one row per statement: statement, where implemented
   (`file:line`), status (met / partial / missing), source (stated or inferred).
   This table is the review. Everything else is supporting detail.
2. **Must resolve before merge** — findings that break a requirement statement or
   hit a red line.
3. **Worth fixing** — real but not blocking.
4. **Open questions** — where the requirement was silent and the code made a choice
   nobody ratified. Name the choice and who should decide.

If the change meets its requirement, say that in one sentence and stop. Inventing
findings to look thorough is the failure mode this skill exists to avoid.
