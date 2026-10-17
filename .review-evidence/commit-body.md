# Restore no-JavaScript recovery for missing dotted URLs

Missing `/random.txt`, `/en/random.txt`, `/es/random.txt` and `/images/retired-asset.jpg` returned HTTP 404 with no HTML language, H1 or main body on the actual local Cloudflare Worker. The proxy matcher excluded all dotted paths, bypassing the existing localized rewrite; dynamic layout/catch-all `notFound()` emitted an error shell requiring JavaScript.

The proxy now uses the existing known-page/product classification for dotted business URLs and the existing explicit HTTP 404 rewrite for missing URLs. Next config builds an exact public-file list and inlines it as a build constant for the proxy, whose real consumer needs to distinguish an existing resource from a missing sibling before filesystem routing. No operator environment configuration is added. API/framework routes and the currently implemented metadata/security-policy routes retain their handlers. There is no extension whitelist, whole-directory bypass, self-request, dependency addition or root-layout reconstruction.

Tests verify server-rendered localized recovery with JavaScript disabled, ordinary missing pages/products, direct placeholder URLs, client recovery, asset bodies/MIME, and absence of inherited OG/Twitter image metadata. Status tests now use the configured Playwright base URL instead of hard-coded port 3000.

## Actual validation

Installed versions: Next 16.4.2, OpenNext Cloudflare 1.20.12, Node 24.20.0.

- Baseline production Worker: requested four paths all 404, raw HTML parsed without executing scripts has empty lang and no H1/main. Added browser cases: **6 failed / 10 passed**, failures are the missing dotted documents.
- `APP_ENV=preview NEXT_PUBLIC_SITE_URL=https://example.invalid NEXT_PUBLIC_BASE_URL=https://example.invalid NEXT_PUBLIC_TEST_MODE=false NODE_ENV=production pnpm build`: passed.
- `APP_ENV=preview NEXT_PUBLIC_SITE_URL=https://example.invalid NEXT_PUBLIC_BASE_URL=https://example.invalid NEXT_PUBLIC_TEST_MODE=false NODE_ENV=production pnpm website:build:cf`: passed, both baseline and repaired Worker.
- `pnpm exec opennextjs-cloudflare preview --env preview`: actual local Worker on port 8787.
- `CI=1 CI_FLAKE_SAMPLING=1 PLAYWRIGHT_BASE_URL=http://localhost:8787 pnpm exec playwright test tests/e2e/not-found-recovery.spec.ts --project=chromium`: **19/19 passed**, zero retries.
- `CI=1 CI_FLAKE_SAMPLING=1 PLAYWRIGHT_BASE_URL=http://localhost:8787 pnpm exec playwright test tests/e2e/not-found-status.spec.ts --project=chromium`: **8/8 passed**, zero retries.
- Raw repaired HTML: all four paths remain404 and contain correct language, H1, description and locale homepage link. All23 baseline resource status/MIME pairs unchanged; actual resource bodies unchanged. The missing `_next` asset retains404/MIME with dynamic error-document bytes differing. This repository serves system/local fonts and has no webfont file payload, confirmed by current CSS and existing layout-fonts contract.
- `node scripts/quality/checks/cloudflare-smoke.js cf-preview-smoke --include-api-health --rounds 2`: passed. Its malformed inquiry admission probe cannot reach delivery providers.
- `pnpm exec vitest run tests/unit/proxy.test.ts`: **14/14 passed**, also independently run by reviewer.
- `pnpm type-check`, `pnpm type-check:tests`: passed.
- Scoped ESLint and Prettier for changed source/tests: passed.
- `pnpm content:check`, dependency-cruiser, `pnpm knip:check`, `pnpm knip:check:production`: passed.
- Authorized full `pnpm test`: 174/175 files and1204/1205 tests passed; one Playwright config-loading test timed out under concurrent local checks. Isolated `pnpm exec vitest run tests/unit/playwright-config.test.ts`:8/8 passed; CI must pass without weakening the test.

The first sandbox build failed on a denied internal port and cached that failure; the failed `.next` was moved to Trash and the authorized rebuild passed. The first full test attempt encountered sandbox-denied Trash renames and localhost listeners; authorized retry is recorded separately. An initial new resource test incorrectly expected a font preload; inspection confirmed the existing system-font contract, and the test now checks the actual baseline.

## Independent review and preservation

Independent GPT-6 review requested through the `gpt-6-astra`/medium dispatch: PASS on initial and final six-file diff, no findings. Reviewer independently ran proxy tests14/14; it did not build or alter files. The reviewer session self-identifies the GPT-6 family; exact requested model is dispatch metadata.

Original user work in `package.json` (`test:mutation`), `.lavish/`, and `scripts/quality/checks/mutation-audit.mjs` is excluded and preserved by SHA256. A concurrent documentation-only update to `docs/技术栈.md` appeared during execution and is likewise excluded and preserved. Whole-working-tree lint/format/React Doctor include those pre-existing drafts: mutation script complexity warning and `.lavish` formatting/one async-loop warning prevent a clean whole-directory result. No original files or gate configuration were changed to hide them. The same React Doctor gate on tracked changes reports0 errors/0 warnings; clean-checkout CI remains required before merge.

Local evidence: `.planning/dotted-404-2026-10-17/` (before/after HTML, browser reports, resource comparisons, builds, checks and review record). No deployment, real inquiry, or delivery-provider call was performed. Failed build cache cleanup used Trash, not permanent deletion. Development dependency advisories are outside this change.
