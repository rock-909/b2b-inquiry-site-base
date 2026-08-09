# Product catalog clean-room run 2

- Executed on: `2026-08-09`
- Candidate tag: `candidate-2026-08-07.2`
- Candidate commit: `1ae28ef9e38f9f000b34ddbbfb62f5202a5b997d`
- Scenario: `Northline Process Equipment`
- Verdict: `PASS`

## Derived surface

The allowed business surface was converted to a three-product catalog:

- `/products`
- `/products/compact-transfer-pump`
- `/products/chemical-dosing-skid`
- `/products/mobile-filtration-unit`

The scenario changes 51 files with 949 insertions and 223 deletions. Product copy stays in the existing message packs; the extra Run 1 `product-catalog.ts` copy layer was not recreated.

The complete patch, including seven untracked new route files, is stored in `product-catalog.patch.gz`. `product-catalog-name-status.txt` and `product-catalog-stat.txt` record the complete modification surface.

## Boundary audit

The worktree remained detached at the candidate commit and contained no staged content. A combined tracked-plus-untracked scan found no changes under:

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

`git diff --check` passed. The compressed patch passed `gzip -t`, and its decompressed content passed `git apply --check` against the candidate.

## Verification

Passed on the final derived state:

- `pnpm type-check`;
- `pnpm type-check:tests`;
- `pnpm lint:check`;
- `pnpm test`: 223 files, 1697 tests;
- `pnpm content:check`;
- `pnpm knip:check`;
- `pnpm exec prettier --check .`;
- `git diff --check`;
- Playwright Chromium: 67 passed, 1 skipped;
- Next.js 16.3.0 production build;
- OpenNext Cloudflare 1.20.2 build;
- Cloudflare static asset header check;
- Wrangler 4.115.0 preview dry-run.

Strict public-launch validation exited `1` as expected. Sentinel blockers covered the `.invalid` public URL, fictional contact values, pending logo and template R2 names. Environment-readiness blockers separately covered missing production Redis, rate-limit pepper, Turnstile, Resend, Airtable and Cloudflare platform configuration.

## Runtime finding resolved inside the allowed surface

The first Run 2 implementation used `/products/[offeringId]`. Under Next.js 16 Cache Components, the desired static-only parameter behavior could not use `dynamicParams`, and `notFound()` after streaming produced a soft 404 with HTTP 200.

The derived site now uses three literal product routes with one shared `product-detail-page.tsx` renderer. Unknown product URLs fall through to the real catch-all 404 without changing middleware, proxy or inquiry infrastructure.

