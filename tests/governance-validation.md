# Test governance validation (2026-10-09)

Scope: tests, test configuration and gates only. Production source, dependencies
and lockfile are unchanged. No provider calls or deployment. Full mutation
testing is deferred to the user's separate nightly run.

## Review decisions

- R1 accepted: parsing source AST is still not runtime proof. Removed the cache
  AST test and client-source scanner. Semgrep now owns the explicit critical
  entrypoint cache policy and client env/PII import policy, with positive and
  negative files scanned by the real CLI. Runtime env rejection remains a unit
  test; the existing dependency-graph gate protects transitive runtime imports.
  OG asset existence and root metadata file absence are replaced by local HTTP
  image responses and rendered root-404 metadata checks.
- R2 accepted: removed all three newly introduced `.lavish` exclusions from
  Vitest, React Doctor and Semgrep. Local review artifacts are not part of the
  delivery worktree and do not justify permanent gate exclusions.
- R3 accepted: the actual commands and negative evidence are recorded below.

## Executed checks

Delivery worktree: `/tmp/b2b-test-governance-delivery`.

| Command | Observed result |
| --- | --- |
| `pnpm type-check` | Pass |
| `pnpm type-check:tests` | Pass |
| `pnpm test` | 175 files, 1202 cases passed; includes 28 Node integration cases |
| `pnpm exec playwright test tests/e2e/seo-validation.spec.ts tests/e2e/not-found-status.spec.ts --project chromium --workers 1` | 15 passed, no retry |
| `pnpm exec semgrep scan --config semgrep.yml --error --strict --metrics=off --disable-version-check` | 417 files, 0 findings, no parse errors |
| `python3 tests/fixtures/semgrep/check.py` | 5 scanned fixture files, 19 exact findings, no unexpected matches (Semgrep 1.176.0) |
| `uv tool run --from semgrep==1.162.0 --python 3.12 python tests/fixtures/semgrep/check.py` | Same scanner-fixture proof under the CI version |

During development the scanner fixture check failed on invalid import patterns,
then caught a missing unaliased import and a false positive for an ordinary
string. These were fixed in the rules, not by dropping the negative fixtures.
The corpus also covers comments, server-only imports and same-line directives.

Earlier, unchanged form proofs were run with:
`pnpm exec playwright test tests/e2e/contact-submit-journey.spec.ts tests/e2e/embedded-form-surfaces.spec.ts --project=chromium --workers=1`:
8 passed, no retries or skips. These browser tests use checked API stubs; the
Node project executes the real schema, limiter and delivery pipeline with only
outbound fetch replaced.

## Isolated killed mutant (already executed; not a full mutation run)

Only in a disposable copy `/tmp/b2b-test-governance-USKRCB`, invert the condition
in `src/lib/lead-pipeline/process-lead.ts`:

```diff
-    if (!emailSent && !recordCreated) {
+    if (emailSent && recordCreated) {
```

From that copy, the exact executed command was:

```sh
env -i PATH=/Users/Data/Library/pnpm/nodejs/24.20.0/bin:/usr/bin:/bin \
  HOME=/tmp/b2b-test-governance-USKRCB/home \
  TMPDIR=/tmp/b2b-test-governance-USKRCB/tmp \
  sandbox-exec -p '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath "/private/tmp/b2b-test-governance-USKRCB") (literal "/dev/null"))' \
  node node_modules/vitest/vitest.mjs run --configLoader=native \
  --project inquiry-integration --reporter=json --outputFile=evidence/mutant.json
```

Same invocation for baseline/restored, changing only the report filename and
restoring the single mutated line. Results: baseline 28 pass (exit 0), mutant
13 fail / 15 pass (exit 1), restored 28 pass (exit 0). Exact failure:

```text
lead pipeline (in-process integration)
  both channels fail: rejects with an inquiry processing error
AssertionError: expected 200 to be 500
tests/integration/api/lead-pipeline-in-process.test.ts:546:29
```

This is an assertion kill, not a timeout/import failure. Original and restored
production file SHA256:
`9606370bd9170961066509c9c596ee7266cc58445adf955f0f1a26fbb84ce4c5`.
Local JSON receipts remain in the original worktree at
`.lavish/test-governance-2026-10-08/{baseline,mutant,restored}.json`.

## Deletion and replacement coverage

Executed reference search:

```sh
rg -n 'contact-entry-boundary|cache-directive-policy|env-boundary|blog-archive-list-item|lead-delivery|proxy.test|pnpm test|semgrep' \
  .github tests src/config/__tests__/single-site.test.ts vitest.config.mts
git diff --name-only 20d58f6 -- src
```

No workflow explicitly invokes a removed test filename. The `lead-delivery`
hit is an unrelated import-graph fixture facade. CI runs default `pnpm test`
(both projects) and the Semgrep scan plus fixture checker; Semgrep failure
blocks the aggregate CI job. All changed `src/` paths are test files.

- Removed mocked delivery cases: real Node pipeline covers delivery outcomes,
  abort timeout, abuse rejection and external request content.
- Removed contact source-spelling test: existing real import-graph gate covers
  the client form dependency boundary.
- Removed empty blog-item test: it asserted no behavior and had no consumers.
- Removed proxy file existence assertions: proxy response behavior tests stay.
- Removed cache/client-source scans: ERROR-level Semgrep policies above, plus
  real public env allowlist rejection and runtime dependency-graph tests.
- Removed OG filesystem assertions: metadata generator assertions stay; browser
  checks now verify the served image and actual root-404 metadata.

No check here proves Worker bindings, real Airtable persistence, Resend delivery
or inbox receipt. Those remain production acceptance work, not mocked evidence.

## Follow-up: composition and replacement negative checks

A subsequent review correctly noted that removing the fake-Logo assertion
without a replacement lost Header composition coverage. The Logo mock is now
removed; the Header test renders the real Logo and asserts the accessible
brand link points home. The existing routing test adapter is unchanged.

The following focused checks were executed in an archived disposable copy,
`/tmp/b2b-governance-negative-KjkMzJ`, with installed dependencies linked from
the delivery worktree. No production file in either Git worktree was edited.
Each unit mutant was restored before applying the next one.

```sh
pnpm exec vitest run --configLoader=native \
  src/components/layout/__tests__/header.test.tsx \
  tests/architecture/env-boundary.test.ts \
  tests/architecture/runtime-dependencies.test.ts \
  --reporter=json --outputFile=evidence/baseline.json
```

Baseline: 17 passed. For each row below, ran the same Vitest invocation with
only that row's test file and `--outputFile=evidence/<name>-mutant.json`.

| Name | Test file | Isolated fault | Observed result (exit 1) |
| --- | --- | --- | --- |
| header | `src/components/layout/__tests__/header.test.tsx` | Replace Header's `<Logo locale={locale} />` with `{null}` | 1 failed / 3 passed; accessible brand link not found |
| env | `tests/architecture/env-boundary.test.ts` | Replace getter allowlist check/read with `return process.env[key]` | 6 failed; expected function to throw |
| graph | `tests/architecture/runtime-dependencies.test.ts` | Add `import "zod"` to logger | 2 failed / 5 passed; public/logger and transitive form dependency sets contain a forbidden entry |
| deferred | `tests/architecture/runtime-dependencies.test.ts` | Replace deferred form's lazy import with static `import { InquiryForm }` | 1 failed / 6 passed; expected dynamic=true, received false |

After restoring all four source changes, the baseline command with
`--outputFile=evidence/restored.json` passed all 17 cases (exit 0).

Browser fault injection used copies of the two specs, against the already-built
local delivery server (not providers). Executed before injection, with injection,
and after removal:

```sh
env PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm exec playwright test \
  tests/e2e/seo-validation.spec.ts tests/e2e/not-found-status.spec.ts \
  --project chromium --workers 1 --grep 'homepage OG|root 404' --reporter=list
```

- Baseline: 2 passed (exit 0).
- OG fault: after navigation, change the rendered `og:image` URL to local
  `/missing-og-negative.png`. The real image HTTP check fails: expected 200,
  received 404.
- Root-404 fault: after navigation, append a `meta[property="og:image"]` to
  the actual document head. The DOM assertion fails: expected 0, received 1.
- Injected run: both assertions fail (exit 1), not a navigation/build error.
- Restored run: 2 passed (exit 0).

These browser checks prove sensitivity to broken observable output; they are
not claimed as production-source mutants. No fault-injection code is committed.
`pnpm lint:check`, `pnpm format:check`, and `git diff --check` also passed for
the preceding review correction.
