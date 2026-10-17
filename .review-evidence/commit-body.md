# Stable dependency refresh — 2026-10-17

Refresh the current single-site stack after the previous upgrade PRs. Registry checks cover all 63 direct dependencies; 26 declarations change, and `pnpm update --depth Infinity` refreshes compatible transitive dependencies. No production source or inquiry contract changes.

## Selected versions and limits

- Next / eslint-config-next 16.4.2, React / React DOM 19.3.1, OpenNext Cloudflare 1.20.12 (AWS adapter 4.1.11), Wrangler 4.151.0.
- Node 24.22.0 LTS in `.node-version`; the supported minimum stays 24.20.0. pnpm 11.28.6 updates the project pin and minimum.
- TypeScript stays 6.0.3: typescript-eslint 8.71.2 supports `<6.1.0`, and TypeScript 7.0.2 has no JavaScript compiler API entry used by this project.
- Node 26 and its types are outside the current Node 24 LTS line; `@types/node` moves to 24.19.2.
- At 2026-10-17 07:08 UTC, ESLint 10.13.0, Wrangler 4.151.1 and Lucide 1.59.0 were younger than the existing 24-hour cooldown. Keep ESLint 10.12.0; select Wrangler 4.151.0 and Lucide 1.58.0. The established Next-family cooldown exception remains unchanged.
- Lefthook 2.2.2 installation failed with `ERR_PNPM_TRUST_DOWNGRADE`: the release lacks the stronger publication evidence of earlier releases. Select 2.2.1, which has GitHub trusted-publisher / SLSA provenance. No trust-policy exception.
- pnpm 12.14.0 starts through a temporary dlx / newer launcher, but the project's existing pnpm 11.24 bootstrap twice failed with `spawnSync .../12.14.0/bin/pnpm ENOEXEC`. Use the latest working 11.x release; no global tool replacement or private bootstrap wrapper.
- All five GitHub Actions latest release tags still match the current pins. Semgrep moves from 1.180.0 to 1.181.0.
- Existing overrides, peer exceptions and Cloudflare compatibility date are unchanged. The Miniflare exception now describes the upstream beta dependency carried by Wrangler.

## Reproduced native test failure and correction

On the upgraded graph, `pnpm test --reporter=json --outputFile=reports/dependency-upgrade-vitest.json` exited 139 (`Segmentation fault: 11`) with the existing forced `pool: "threads"`. A second run with `--maxWorkers=2` also exited 139. macOS crash evidence identifies a WorkerThread native-module registration stack through `swc.darwin-arm64.node` and its decoded native carrier. The isolated Node inquiry suite (28 tests) and Next-config suite (7 tests) pass.

The same complete suite with `--pool=forks` passed: 175 files / 1203 tests. Remove the explicit threads override to use Vitest's default process isolation. Then the original command, without `--pool` or `--maxWorkers`, passed all 175 files / 1203 tests. Discovery, assertions and retries are unchanged.

The official Vitest native-code troubleshooting guide recommends process isolation for this failure class: https://github.com/vitest-dev/vitest/blob/main/docs/guide/common-errors.md . The exact underlying upstream native defect is not claimed as proven.

## Executed verification

Commands ran on Node 24.22.0 / pnpm 11.28.6. Builds and Playwright ran serially against `.next`.

| Command | Observed result |
| --- | --- |
| `pnpm install`, then `pnpm update --depth Infinity` | Passed; no new overrides or policy exclusions |
| Move node_modules to Trash, then `pnpm install --frozen-lockfile` | Passed, fresh installation |
| `pnpm peers check` | No peer dependency issues |
| `pnpm content:check` | Both locales valid, 154 keys each |
| `pnpm type-check` / `pnpm type-check:tests` | Passed |
| `pnpm lint:check` / `pnpm format:check` | Passed |
| `pnpm knip:check` / `pnpm knip:check:production` | Passed; existing CSS configuration hints only |
| `pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err` | Passed, 200 modules / 445 dependencies |
| `pnpm react:doctor` | complete=true, 0 errors / 0 warnings; no production-source diff to scan |
| `pnpm test --reporter=json --outputFile=reports/dependency-upgrade-vitest.json` | Passed, 175 files / 1203 tests after removing forced threads |
| `uv tool run --from semgrep==1.181.0 --python 3.12 python tests/fixtures/semgrep/check.py` | Passed, 5 fixtures / 19 exact findings / no extras |
| Same tool environment: `semgrep scan --config semgrep.yml --error --strict --metrics=off --disable-version-check --quiet --json-output reports/semgrep-upgrade.json` | Passed, 417 files / 0 findings / 0 parse errors |
| `pnpm build` with preview + local URL + test-mode public variables | Passed, 24 static pages |
| `node scripts/quality/checks/client-boundary.js --build-artifacts` | Passed; individual marker chunk observation, not total browser transfer |
| `NEXT_PUBLIC_SITE_URL=http://localhost:3000 node scripts/quality/checks/prerender-static.js` | Passed |
| `CI=1 CI_FLAKE_SAMPLING=1 pnpm exec playwright test --project=chromium` | 79 passed, zero retries |
| `pnpm website:build:cf` with preview + sentinel URL + test mode false | Passed, Next16.4.2 / OpenNext1.20.12 / AWS4.1.11 |
| `node scripts/quality/checks/cloudflare-config-check.js` | Passed |
| `node scripts/quality/checks/cloudflare-artifact-config.js` | Passed, 3 artifacts |
| `node scripts/quality/checks/cloudflare-static-asset-headers.js` | Passed |
| `APP_ENV=preview pnpm exec wrangler deploy --dry-run --env preview` | Passed; Total Upload 5735.58 KiB / gzip 1672.85 KiB; no upload |
| `pnpm exec opennextjs-cloudflare preview --env preview` | Local Worker started; 21 local R2 entries populated |
| `node scripts/quality/checks/cloudflare-smoke.js cf-preview-smoke --include-api-health --rounds 2` | Passed against local Worker |
| `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url http://127.0.0.1:8787` | Passed against local Worker, including 415 inquiry admission probe |
| Extra local HTTP probes | All 7 Spanish public page / product routes return 200 and lang=es; cross-origin JSON inquiry rejected with 403 before delivery |
| `pnpm exec eslint vitest.config.mts` and focused Prettier after pool edit | Passed |
| `git diff --check` | Passed |

## Security report boundary

`pnpm audit --prod --json` reports zero vulnerabilities. Full `pnpm audit --json` moves from baseline 37 (1 critical / 18 high / 15 moderate / 3 low) to 4 (3 high / 1 moderate), all development-only and already present in the baseline. No audit ignore was added. The remaining reports have no published patched version:

- extract-zip via Lighthouse / Puppeteer: GHSA-jmr9-qjv8-65gv and GHSA-7pqw-9j4j-h8q3.
- braces via eslint-config-next / fast-glob / micromatch: GHSA-vfj7-8cjw-p6xm.
- sprintf-js via Lighthouse / js-yaml / argparse: GHSA-hp3w-g68c-fv3c.

This is local engineering / local Worker evidence. It does not prove production deployment, real provider writes, email delivery, or owner inbox receipt. No real inquiry, provider call, deployment, or full mutation suite ran.


## Existing 404 HTML boundary

An extra raw-HTML probe requiring `lang="es"`, H1 and main content on `/es/nope` and `/es/products/not-real` failed: these responses are 404 with an `__next_error__` shell and localized content in the hydration payload. A fresh archive of `origin/main@8fed5b47` with its own frozen install, Next16.3.8 / OpenNext1.20.9 build and local Worker reproduced the same shell on both paths and `/nope`. The generated placeholder artifacts agree. This pre-existing no-JavaScript 404 limitation is not fixed or presented as passing here; browser recovery coverage still passes with JavaScript. Normal Spanish public pages contain server-rendered lang=es HTML. The upgrade does not introduce this observed boundary.
