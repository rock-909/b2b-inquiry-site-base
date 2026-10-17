# Browser recovery fixes — 2026-10-17

Restore the complete browser matrix and server-rendered recovery content for ordinary missing public routes. No dependency changes, deployment, real inquiry or provider calls. The user authorized Codex to execute the remaining delivery gates while retaining an independent GPT-6 review; the repository's trusted no-mistakes configuration is unchanged. This is not a claim that the Claude-backed no-mistakes pipeline passed.

## Observed failures and changes

- Both original mobile failures reproduce: the forced-colors test opens a desktop-only language menu that is hidden at mobile widths. Mobile Chrome and Mobile Safari each time out waiting for that dropdown. The production mobile drawer instead contains native details / summary and language links.
- The test now opens the actual mobile drawer, activates its language disclosure with Enter, and uses keyboard navigation to focus Español. It still requires the correct link destination and a visible outline at least 2px wide. The desktop highlighted-item assertions remain intact. On macOS WebKit, ordinary Tab skips links; an actual diagnostic showed Tab focusing the close button and Option-Tab focusing Español. Only that platform uses Alt+Tab. Apple documents this shortcut: https://support.apple.com/en-gb/guide/safari/cpsh003/mac .
- The first complete remote matrix at commit 037703c7 passed 424/425 but exposed a desktop WebKit focus-readiness race: the menu is visible before its animation-frame focus handoff completes. The remote failure snapshot shows the menu container active with no highlighted item. With a controlled 300ms delay in requestAnimationFrame callbacks, the unchanged test reproduces the failure: ArrowDown targets BODY, then focus enters the menu. Add an assertion that focus has entered the menu before sending the single ArrowDown. Under the identical frame delay it passes. No production focus code, retries, highlighted count or visibility assertion is changed. Diagnostic timing overrides are not committed.
- Without JavaScript, English and Spanish ordinary missing pages and missing products return HTTP 404 but no lang, heading or recovery link. The existing proxy already rewrites these requests to a per-locale placeholder with status 404. Render the existing localized recovery view directly at that placeholder instead of throwing into a client-only error recovery path. Keep noindex metadata, the existing route table and proxy unchanged. Remove the obsolete i18n rule exemption for this page.
- Direct catch-all requests excluded by the proxy (for example /es/random.txt) still call notFound(); rendering them normally would produce an incorrect HTTP 200. Two added HTTP tests reproduced that intermediate regression before adding the guard. Dotted URLs retain their prior framework/error-boundary behavior; their no-JavaScript empty HTML remains outside this bounded fix and is not presented as resolved. Repairing that boundary requires a separate root-layout / framework-error design decision.

## Executed verification

Node 24.22.0 / pnpm 11.28.6. Builds, OpenNext and Playwright servers run serially.

| Command / controlled check | Observed result |
| --- | --- |
| Original forced-colors spec, grep `highlighted language`, Mobile Chrome then Mobile Safari | Each failed before the test correction: desktop dropdown never appears |
| New 4 no-JavaScript cases on original page behavior, Chromium | 4 failed: HTTP 404 with missing lang and recovery content |
| New catch-all behavior unit test with original page function | Failed before the page fix; original function does not return visible recovery content |
| Temporarily disable `*:focus-visible` outline only in the test browser and run mobile language case | Fails at the explicit outline assertion; restore the override and it passes. No production CSS change |
| Added /en/random.txt and /es/random.txt request tests against intermediate direct-render build | Both failed with actual 200; guard restores notFound for non-placeholder catch-all requests |
| `pnpm type-check` and `pnpm type-check:tests` | Passed |
| `pnpm lint:check` and `pnpm format:check` | Passed |
| `pnpm test src/__tests__/proxy-locale-cookie.test.ts 'src/app/[locale]/__tests__/not-found.test.tsx' 'src/app/[locale]/[...rest]/__tests__/not-found.test.tsx' 'src/app/[locale]/[...rest]/__tests__/page.test.tsx'` | 4 files / 18 tests passed |
| `pnpm react:doctor` | complete=true, 0 errors / 0 warnings |
| `CI=1 CI_FULL_COVERAGE=true CI_FLAKE_SAMPLING=1 PLAYWRIGHT_REBUILD_SERVER=true pnpm exec playwright test tests/e2e/forced-colors-focus.spec.ts tests/e2e/not-found-recovery.spec.ts --project=chromium --project=webkit --project='Mobile Chrome' --project='Mobile Safari'` | Final code: 40 passed, zero retries |
| `APP_ENV=preview NEXT_PUBLIC_SITE_URL=https://example.invalid NEXT_PUBLIC_BASE_URL=https://example.invalid NEXT_PUBLIC_TEST_MODE=false NODE_ENV=production pnpm website:build:cf` | Final code: passed, 24 static pages |
| `node scripts/quality/checks/cloudflare-config-check.js`, `cloudflare-artifact-config.js`, `cloudflare-static-asset-headers.js` | All passed against final Cloudflare artifact |
| `APP_ENV=preview pnpm exec wrangler deploy --dry-run --env preview` | Passed; no upload |
| `pnpm exec opennextjs-cloudflare preview --env preview`, then `node scripts/quality/checks/cloudflare-smoke.js cf-preview-smoke --include-api-health --rounds 2` | Local Worker: passed |
| `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url http://127.0.0.1:8787` | Local Worker: passed, including 415 inquiry admission probe |
| `CI=1 CI_FLAKE_SAMPLING=1 PLAYWRIGHT_BASE_URL=http://localhost:8787 pnpm exec playwright test tests/e2e/not-found-recovery.spec.ts --project=chromium` | Final local Worker: all 8 passed, including no-JS documents and direct catch-all status guard |
| `git diff --check` | Passed |

Additional executed checks after the remote race was found:

- `CI=1 CI_FULL_COVERAGE=true CI_FLAKE_SAMPLING=1 pnpm exec playwright test tests/e2e/forced-colors-focus.spec.ts --project=webkit --grep 'language choice' --repeat-each=12`: 12/12 pass locally, so a green local repeat was not treated as evidence that the remote failure disappeared.
- Final readiness assertion, same four-browser focused command without rebuilding (production source unchanged): 40/40 passed; focused ESLint, Prettier and test TypeScript checks passed.
- Same single desktop WebKit case with a temporary 300ms requestAnimationFrame delay and key/focus event logging: before readiness assertion, 1 failure at unchanged highlighted-count assertion; event order is Enter on trigger, ArrowDown on BODY, focus on menu. After readiness assertion with identical delay, 1 pass, focus enters menu before item navigation. The temporary instrumentation is restored after each run.

Local logs, traces and controlled-check artifacts are retained under the original checkout's ignored `.planning/browser-recovery-2026-10-17/evidence/`; CI independently runs the tracked tests. Local evidence does not establish a live deployment.

## Remaining development dependency advisories

Fresh `pnpm audit --prod --json`: 0. Full `pnpm audit --json`: 3 high / 1 moderate. All four advisories remain unpatched in current registry releases; no audit ignore, private patch, new override or removal of a check tool was introduced.

| Advisory | Current consumer and risk |
| --- | --- |
| https://github.com/advisories/GHSA-jmr9-qjv8-65gv | extract-zip 2.0.1 via Lighthouse / Puppeteer browser installer: malicious symlink archive traversal |
| https://github.com/advisories/GHSA-7pqw-9j4j-h8q3 | Same installed extract-zip: archive symlinks can cause writes outside the destination |
| https://github.com/advisories/GHSA-vfj7-8cjw-p6xm | braces 3.0.3 via Next ESLint / fast-glob / micromatch: deeply nested glob patterns exhaust the stack |
| https://github.com/advisories/GHSA-hp3w-g68c-fv3c | sprintf-js 1.1.3 via LHCI utils / js-yaml / argparse: precision specifiers exhaust resources |

Current consumer inspection: Next ESLint passes its own rootDir setting (not inquiry input) to glob; this repository does not configure rootDir. LHCI custom Puppeteer startup requires puppeteerScript, which this repository does not configure; ordinary LHCI uses chrome-launcher. Argparse formats its own CLI help. These observations limit the observed exposure; they do not eliminate the advisories. A compatible upstream fix is still required. No malicious archive / denial-of-service proof was executed.

## Existing user-owned mutation work

Preserve the original checkout's `test:mutation`, `scripts/quality/checks/mutation-audit.mjs` and all 26 `.lavish` files byte-for-byte; none is part of this change. The mutation script is an unintegrated draft, not a trustworthy gate: it edits production source in place, has only in-memory restoration, does not verify a clean baseline or set a timeout, treats every child-process failure as a killed mutant, excludes skips from its denominator, and does not fail the process when mutants survive. Some mutant labels do not match their edits. Do not run or publish it as validation evidence in this delivery. Before adoption it needs an isolated disposable copy, baseline proof, assertion-versus-infrastructure error classification, accurate mutations, and failing exit status for survivors / invalid runs. `.lavish` contains historical drafts and evidence; its old checkpoint is not current project status.
