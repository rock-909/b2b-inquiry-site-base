# Phase 2 clean-room run 1 summary

- Executed on: `2026-08-07`
- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Overall verdict: `TEMPLATE_STRUCTURAL_FAILURE`

## Scenario results

| Scenario | Changed files | Allowed checks | Full tests | Verdict |
| --- | ---: | --- | --- | --- |
| Product catalog | 46 | PASS | 38 failed | `TEMPLATE_STRUCTURAL_FAILURE` |
| Service business | 47 | PASS | 38 failed | `TEMPLATE_STRUCTURAL_FAILURE` |
| Hybrid offering | 55 | PASS | 38 failed | `TEMPLATE_STRUCTURAL_FAILURE` |

All three scenarios were created from the same detached candidate commit. Control-side diff audits found no final changes in the forbidden production/test paths, and all three strict public-launch checks remained red for the expected sentinel and environment-readiness reasons.

Heavy Playwright/Next/OpenNext/Wrangler lanes were not entered because the required full test gate failed first.

## Common modification surface

Thirty-nine files changed in all three scenarios. The common surface is concentrated in the intended derivation areas:

- company/legal/contact MDX;
- base and B2B-lead messages;
- homepage, request-quote and sitemap tests;
- footer, inquiry-copy, mobile-navigation and hero tests;
- offerings, pages, paths, navigation, links, site identity and SEO config;
- content manifest and buyer-facing route inventories;
- Lighthouse route list and public Wrangler values.

Scenario-only files were the expected `/products`, `/services`, `/solutions` and `/custom-project` pages plus their local tests.

## Confirmed template root cause

The generic inquiry/API proof layer is coupled to one concrete example offering:

```text
custom-fabrication
Custom Fabrication
```

The literals are spread across six core/API test files. After a legitimate business changes `src/config/offerings.ts`, those tests reject the new configuration before reaching the Turnstile, rate-limit, provider, logging and either-channel behavior they are meant to prove.

This is a template defect, not three separate business defects. The derived sites must not edit those forbidden tests, and retaining the example offering would corrupt their business truth.

## Secondary template friction

`message-key-usage` depends on `git ls-files`, so new untracked pages are not visible until the derivator marks them intent-to-add. This should be fixed in the template rather than taught as a required clean-room ritual.

## Non-template implementation observations

- The product run introduced a page-copy file named `product-catalog.ts`; run 2 should confirm whether messages are simpler.
- The hybrid run expanded a generic i18n contract test by roughly 250 lines; run 2 should keep business-key tests local instead.

These observations do not replace the confirmed common blocker.

## Required next action

1. Fix the template's generic inquiry/API tests so their offering-specific cases use test-owned or configuration-independent fixtures rather than a business literal.
2. Make `message-key-usage` include untracked source files without requiring index manipulation.
3. Run the full template verification.
4. Create `candidate-2026-08-07.2` from the repaired template.
5. Move the run-1 worktrees to Trash after preserving these patches and reports.
6. Recreate all three scenarios from zero; do not patch the existing derived directories.

The template remains:

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```
