# Hybrid offering clean-room run 1

- Executed on: `2026-08-07`
- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario: `ModuCore Industrial Systems`
- Verdict: `TEMPLATE_STRUCTURAL_FAILURE`

## Derived surface

The allowed business surface was converted to two standard offerings plus a custom-project path:

- `/solutions`
- `/solutions/standard-control-panel`
- `/solutions/modular-monitoring-kit`
- `/custom-project`

The two standard pages use canonical offering IDs. The custom-project page keeps the general inquiry contract and guides buyers to use `interest` and `message`; it does not invent a custom offering or dynamic form schema.

The patch changes 55 files with 1344 insertions and 254 deletions. The full patch is stored losslessly in `hybrid-offering.patch.gz`.

## Boundary audit

Temporary edits to shared environment and Turnstile presentation files were removed before evidence capture. Control-side `git diff --name-only` found no final changes under the forbidden inquiry, lead-pipeline, security, email client, Airtable, shared test setup, quality-script or release-runner paths.

The worktree remained detached at the candidate commit, contained no staged content, and passed `git diff --check`.

## Verification

Passed:

- scenario-focused tests, including the standard-offering/custom-request contract;
- `pnpm type-check`;
- `pnpm type-check:tests`;
- `pnpm lint:check`;
- `pnpm content:check`;
- `pnpm knip:check`;
- `pnpm exec prettier --check .`;
- `git diff --check`.

Full test result:

```text
Test Files  6 failed | 216 passed (222)
Tests       38 failed | 1655 passed (1693)
```

Strict public-launch verification exited `1` as expected. It separately reported the `.invalid` domain, fictional identity/location/contact, pending logo and template R2 values as sentinel blockers, and missing Redis, Turnstile, Resend, Airtable and Cloudflare platform values as environment-readiness blockers.

Playwright, Next build, OpenNext build and Wrangler dry-run were not run because the required full test gate was already red.

## Structural failure

The same concrete `custom-fabrication` fixture causes 38 failures in the six generic core/API test files. The changed production offerings are valid, but the tests reject them before exercising the behavior they claim to prove.

This scenario confirms that the problem is not tied to products or services: even a mixed standard/custom business hits the same forbidden-area coupling.

## Quality observation

The derived patch added a large business-key block to the generic `tests/unit/i18n-message-contract.test.ts`. That is an implementation-specific overreach, not a template feature to preserve. Run 2 should keep scenario-specific message assertions close to the new pages instead of expanding a shared i18n contract file.
