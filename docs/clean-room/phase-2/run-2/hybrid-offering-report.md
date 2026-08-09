# Hybrid offering clean-room run 2

- Executed on: `2026-08-09`
- Candidate tag: `candidate-2026-08-07.2`
- Candidate commit: `1ae28ef9e38f9f000b34ddbbfb62f5202a5b997d`
- Scenario: `ModuCore Industrial Systems`
- Verdict: `PASS`

## Derived surface

The allowed business surface was converted to two standard offerings plus a custom-project path:

- `/solutions`
- `/solutions/standard-control-panel`
- `/solutions/modular-monitoring-kit`
- `/custom-project`

Standard solution links use canonical `offeringId` values. Custom work uses the existing free-text `interest` and `message` fields and does not invent a custom offering ID or add a dynamic form schema.

The scenario changes 56 files with 1125 insertions and 257 deletions. The complete patch, including six untracked new route files, is stored in `hybrid-offering.patch.gz`. `hybrid-offering-name-status.txt` and `hybrid-offering-stat.txt` record the complete modification surface.

## Boundary audit

The worktree remained detached at the candidate commit and contained no staged content. A combined tracked-plus-untracked scan found no changes in the forbidden inquiry, lead-pipeline, security, email, Airtable, shared test setup, quality-script or starter runner paths.

`git diff --check` passed. The compressed patch passed `gzip -t`, and its decompressed content passed `git apply --check` against the candidate.

## Verification

Passed on the final derived state:

- `pnpm type-check`;
- `pnpm type-check:tests`;
- `pnpm lint:check`;
- `pnpm test`: 222 files, 1693 tests;
- `pnpm content:check`;
- `pnpm knip:check`;
- `pnpm exec prettier --check .`;
- `git diff --check`;
- Playwright Chromium: 73 passed, 1 skipped;
- Next.js 16.3.0 production build;
- OpenNext Cloudflare 1.20.2 build;
- Cloudflare static asset header check;
- Wrangler 4.115.0 preview dry-run.

Strict public-launch validation exited `1` as expected. Sentinel blockers covered the `.invalid` public URL, fictional identity/location/contact values, pending logo and template R2 names. Environment-readiness blockers separately covered missing production Redis, rate-limit pepper, Turnstile, Resend, Airtable and Cloudflare platform configuration.

The Run 1 expansion of the generic i18n contract test was not recreated. Scenario-specific inquiry behavior is covered beside the new solution pages in `src/app/[locale]/solutions/__tests__/inquiry-contract.test.ts`.

