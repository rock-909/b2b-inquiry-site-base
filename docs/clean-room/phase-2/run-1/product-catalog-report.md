# Product catalog clean-room run 1

- Executed on: `2026-08-07`
- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario: `Northline Process Equipment`
- Verdict: `TEMPLATE_STRUCTURAL_FAILURE`

## Derived surface

The allowed business surface was converted to a three-product catalog:

- `/products`
- `/products/compact-transfer-pump`
- `/products/chemical-dosing-skid`
- `/products/mobile-filtration-unit`

Site identity, navigation, SEO, messages, legal/contact content, offerings, sitemap, Lighthouse routes, buyer-facing tests and public Wrangler values were changed to the fictional Northline brief.

The patch changes 46 files with 919 insertions and 217 deletions. The full patch is stored losslessly in `product-catalog.patch.gz`.

## Boundary audit

Control-side `git diff --name-only` found no changes under:

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

The worktree remained detached at the candidate commit and contained no staged content. `git diff --check` passed.

## Verification

Passed:

- focused page/config tests, including 12 contact-page tests;
- `pnpm type-check`;
- `pnpm type-check:tests`;
- `pnpm lint:check`;
- `pnpm content:check`;
- `pnpm knip:check`;
- `pnpm exec prettier --check .`;
- `git diff --check`.

Full test result:

```text
Test Files  6 failed | 217 passed (223)
Tests       38 failed | 1660 passed (1698)
```

Strict public-launch verification exited `1` as expected. It separately reported the `.invalid` domain, fictional contact/phone, pending logo and template R2 values as sentinel blockers, and missing Redis, Turnstile, Resend, Airtable and Cloudflare platform values as environment-readiness blockers.

Playwright, Next build, OpenNext build and Wrangler dry-run were not run because the required full test gate was already red.

## Structural failure

Six core/API test files hard-code the retired template offering ID and label:

```text
custom-fabrication
Custom Fabrication
```

The failures occur in:

```text
src/app/api/inquiry/__tests__/route.test.ts
src/lib/lead-pipeline/__tests__/inquiry-handoff.test.ts
src/lib/lead-pipeline/__tests__/lead-schema.test.ts
src/lib/lead-pipeline/__tests__/canonical-inquiry-contract.test.ts
src/lib/lead-pipeline/__tests__/process-lead.test.ts
tests/integration/api/lead-pipeline-real.test.ts
```

Changing those tests is forbidden during derivation, while restoring `custom-fabrication` to the scenario offerings would violate the brief. The template must make its generic inquiry tests independent of one concrete business offering before this scenario can pass.

## Non-blocking observation

The scenario added `src/config/product-catalog.ts` only for page copy while canonical offering identity remains in `src/config/offerings.ts`. Run 2 should check whether that extra copy file is useful or whether messages alone are simpler; it is not the cause of the current structural failure.
