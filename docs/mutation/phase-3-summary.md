# Phase 3 mutation proof summary

- Executed on: `2026-08-09`
- Initial candidate: `candidate-2026-08-09.3`
- Initial commit: `604f4754312554241e21df805c61862876689528`
- Final candidate: `candidate-2026-08-09.4`
- Final commit: `bd9e4786bddc2bd30253fb545edc5e444bbb8ca0`
- Verdict: `PASS`

## Method

Each mutation ran in an isolated detached worktree at the exact candidate
commit. The narrow gate first passed, one production behavior was deliberately
broken, the same gate had to fail, the patch was reversed, and the gate had to
pass again. The experiment worktrees ended with no tracked diff.

The generated-artifact mutation changed only an ignored build artifact and
restored the original artifact afterward. The temporary mutation patches are
not repository artifacts.

## Results

| # | Boundary and mutation | Narrow gate | Mutated result | Restored result |
| ---: | --- | --- | --- | --- |
| 1 | Public-launch sentinel: removed the template Worker-name check from `scripts/quality/checks/production-config.js` | `tests/unit/scripts/validate-production-config.test.ts` | 1 failed, 36 passed | 37/37 passed |
| 2 | Route truth: changed the registered `/terms` path to `/termz` | `src/config/__tests__/pages-config.test.ts` and `tests/architecture/static-public-pages-contract.test.ts` | 3 failed, 3 passed | 6/6 passed |
| 3 | Inquiry offering validation: made the configured-offering predicate always accept | `src/lib/lead-pipeline/__tests__/lead-schema.test.ts` and `src/lib/lead-pipeline/__tests__/canonical-inquiry-contract.test.ts` | 3 failed, 8 passed | 11/11 passed |
| 4 | Turnstile: bypassed inquiry Turnstile validation in `src/app/api/inquiry/route.ts` | `src/app/api/inquiry/__tests__/route.test.ts` | 5 failed, 31 passed | 36/36 passed |
| 5 | Provider tolerance: changed success from "either channel succeeded" to "both channels succeeded" in `src/lib/lead-pipeline/process-lead.ts` | `src/lib/lead-pipeline/__tests__/process-lead.test.ts` | 3 failed, 7 passed | 10/10 passed |
| 6 | Log redaction: logged the raw buyer email from `processValidatedInquiry()` | `src/lib/lead-pipeline/__tests__/process-lead-observability.test.ts` | 1 failed, 1 passed | 2/2 passed |
| 7 | OpenNext pin: replaced exact draft commit `69807b1` with moving PR reference `1318` | `tests/unit/scripts/cloudflare-official-compare.test.ts` | 1 failed, 12 passed | 13/13 passed |
| 8 | R2 binding: changed the preview binding from `NEXT_INC_CACHE_R2_BUCKET` to `BROKEN_CACHE_BUCKET` | `tests/unit/scripts/cloudflare-official-compare.test.ts` | 1 failed, 12 passed | 13/13 passed |
| 9 | Generated artifact: set `.next/required-server-files.json` `productionBrowserSourceMaps` to `true` | `node scripts/quality/checks/cloudflare-artifact-config.js` | exit 1 | 2 artifacts verified, exit 0 |
| 10 | Release failure propagation: continued after a failed release command instead of returning its status | `tests/unit/scripts/release-verify.test.ts` | see below | 9/9 passed on `.4` |

## Surviving mutation and repair

The first release-runner mutation on candidate `.3` survived: all existing
8/8 tests passed after `runReleaseVerify()` was changed to continue after a
failed command. This exposed a real behavior-proof gap rather than a production
implementation defect.

Commit `bd9e4786bddc2bd30253fb545edc5e444bbb8ca0` added one test that requires the
runner to stop at the first failed command and propagate its status. The
template then passed 1692/1692 Vitest tests, React Doctor at 100/100 with zero
diagnostics, and the type, lint, content, knip and Prettier gates.

Candidate `.4` points at that commit. Its focused release-runner baseline passed
9/9 tests. Reapplying the mutation made the new test fail with returned status
`0` instead of `17` while the other 8 tests passed. Reversing the mutation
restored 9/9 passing tests and a clean tracked worktree.

No business clean-room replay was repeated for `.4`: compared with `.3`, its
only repository change is the release-runner behavior test. The production
code and derivation surface are identical.

## Status boundary

Phase 3 proves that the selected high-risk gates detect the production behavior
they claim to protect. It does not prove a real provider deployment or a
business launch. The template remains:

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```

Before `READY_AS_TEMPLATE_FOR_FIRST_BUSINESS` or stable `v1.0.0`, it still
needs:

1. a cold-start derivation performed from the candidate tag using only the
   brief and derivation instructions;
2. product and service derivatives deployed to maintainer-controlled QA
   Cloudflare, R2, Turnstile, Airtable and Resend resources;
3. exact-SHA receipts plus live route, 404, header, asset, no-JS, inquiry,
   provider, cache, concurrency and rollback proof;
4. two consecutive real scenarios without a new structural defect and an
   independent review with no blocker.
