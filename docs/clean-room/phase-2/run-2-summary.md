# Phase 2 clean-room run 2 summary

- Executed on: `2026-08-09`
- Candidate tag: `candidate-2026-08-07.2`
- Candidate commit: `1ae28ef9e38f9f000b34ddbbfb62f5202a5b997d`
- Overall verdict: `PASS`

## Scenario results

| Scenario | Changed files | Full Vitest | Playwright Chromium | Build/Cloudflare | Verdict |
| --- | ---: | --- | --- | --- | --- |
| Product catalog | 51 | 1697/1697 | 67 passed, 1 skipped | PASS | `PASS` |
| Service business | 49 | 1694/1694 | 73 passed, 1 skipped | PASS | `PASS` |
| Hybrid offering | 56 | 1693/1693 | 73 passed, 1 skipped | PASS | `PASS` |

All three scenarios were recreated from clean detached worktrees at the same candidate commit. None contained staged content, and the final tracked-plus-untracked scans found no changes in the forbidden inquiry, provider, security, shared test infrastructure or starter-check paths.

Each complete patch passed `gzip -t` and `git apply --check`. The patch artifacts explicitly include new untracked business route files rather than relying on index manipulation.

## What Run 2 proves

The repaired candidate can be independently changed into:

- a three-product catalog;
- a pure field-service business;
- a standard-offering plus custom-project business.

All three retain the same inquiry API, lead pipeline, security controls, Airtable/Resend boundaries, OpenNext build and Cloudflare deployment shape. New business work remained in identity, content, messages, navigation, offerings, page routes, presentation and their buyer-facing tests.

Forty-one files are common to all three modification surfaces. They are the expected site identity, messages, legal/contact content, navigation, offerings, SEO, route inventory, public Wrangler values and buyer-facing tests. Scenario-only additions are the literal `/products`, `/services`, `/solutions` and `/custom-project` route files and their local tests.

## Run 1 template defects are closed

Run 1 failed because generic inquiry/API tests were coupled to the example `custom-fabrication` offering, and `message-key-usage` ignored untracked source files.

Candidate `.2` moved generic offering proof to test-owned fixtures and made the message scan include tracked and untracked non-ignored files. Run 2 passed without editing the protected test or inquiry infrastructure and without `git add -N`.

The two Run 1 overreaches were also removed:

- product copy uses existing message packs instead of a new `product-catalog.ts` layer;
- hybrid business assertions live beside the solution pages instead of adding roughly 250 lines to the generic i18n contract test.

## Runtime finding from the product scenario

A dynamic `/products/[offeringId]` route produced a soft 404 under Next.js 16 Cache Components because `dynamicParams` was unavailable and the streamed `notFound()` response retained HTTP 200.

The scenario now uses literal product routes with a shared renderer. Unknown product paths return a real 404 without modifying proxy or infrastructure code. The service and hybrid scenarios already use the same simple literal-route shape.

## Verification boundary

Every scenario passed:

- type checks, lint, full Vitest, content checks, knip, Prettier and diff checks;
- Playwright Chromium;
- Next.js 16.3.0 build;
- OpenNext Cloudflare 1.20.2 build;
- static asset header validation;
- Wrangler 4.115.0 preview dry-run.

Every strict public-launch command exited `1` for the expected two classes of blockers: fictional/template sentinel values and missing real production environment/provider configuration. This is the correct result for clean-room sites and is not a deployment failure.

## Remaining template-level follow-up

An exploratory `pnpm react:doctor` run from the detached product worktree fell back to a full-repository scan and reported a score of 83/100 with 1 error and 15 warnings. The diagnostics point at candidate core files rather than scenario business routes.

React Doctor was not part of the Phase 2 required gate, so it does not change the three clean-room scenario verdicts. It does block any stronger claim that the candidate is ready for the first real business. The next step is to review those diagnostics in the template repository, make only confirmed minimal fixes, create a new candidate if core code changes, and then perform another clean derivation proof.

Phase 2 is complete, but the template remains:

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```

This does not prove `READY_AS_TEMPLATE_FOR_FIRST_BUSINESS`, `PUBLIC_LAUNCH_READY` or `v1.0.0`.

