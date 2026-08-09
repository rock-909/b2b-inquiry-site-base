# Candidate 3 service-business clean replay

- Executed on: `2026-08-09`
- Candidate tag: `candidate-2026-08-09.3`
- Candidate commit: `604f4754312554241e21df805c61862876689528`
- Scenario: `FieldAxis Reliability Services`
- Verdict: `PASS`

## Purpose

Candidate `.3` changes shared client code after the three-scenario Run 2 proof. This targeted replay checks that the React Compiler cleanup did not break a real derived business surface. It is a post-change clean replay, not a replacement for the completed three-scenario Run 2.

The Run 2 FieldAxis patch was applied without conflict to a new detached worktree at candidate `.3`. The final scenario changes 50 files with 985 insertions and 235 deletions.

## Derived adjustment

The first replay inherited two React Doctor warnings because `service-page.tsx` exported metadata/static-param helpers beside a component. The fix was limited to the derived service route surface: the two helpers and shared types moved to `service-page-data.ts`; page behavior and route contracts stayed unchanged.

No generator, runtime service mode, provider abstraction or product catalog model was added.

## Boundary audit

The worktree remained detached at `604f4754312554241e21df805c61862876689528` and contained no staged content. The combined tracked-plus-untracked scan found no changes under:

```text
src/app/api/inquiry/
src/lib/lead-pipeline/
src/lib/security/
src/lib/email/
src/lib/airtable/
src/components/security/
src/test/
scripts/quality/
scripts/starter-checks.js
```

The complete patch includes all new service route files. It passed `gzip -t` and `git apply --check` against candidate `.3`.

## Verification

Passed on the final replay state:

- `pnpm install --frozen-lockfile`;
- `pnpm type-check`;
- `pnpm type-check:tests`;
- `pnpm lint:check`;
- `pnpm test`: 223 files, 1695 tests;
- `pnpm content:check`;
- `pnpm knip:check`;
- `pnpm exec prettier --check .`;
- `git diff --check`;
- React Doctor local scan: 0 diagnostics; the remote score API was unavailable during the final run;
- Playwright Chromium: 73 passed, 1 skipped;
- Next.js 16.3.0 production build;
- OpenNext Cloudflare 1.20.2 build;
- Cloudflare static asset header check;
- Wrangler 4.115.0 preview dry-run.

Strict public-launch validation exited `1` as expected and kept fictional/template sentinel blockers separate from missing production environment/provider configuration.

## Result

Candidate `.3` accepts a clean service-business derivation after the shared React Compiler changes. This closes the immediate follow-up from Run 2, but it does not complete mutation proof, cold-start Agent proof or real QA-provider deployment acceptance.

