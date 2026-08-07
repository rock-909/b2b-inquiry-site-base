# Service business clean-room run 1

- Executed on: `2026-08-07`
- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario: `FieldAxis Reliability Services`
- Verdict: `TEMPLATE_STRUCTURAL_FAILURE`

## Derived surface

The allowed business surface was converted to a pure service business:

- `/services`
- `/services/site-inspection`
- `/services/preventive-maintenance`
- `/services/fault-diagnostics`

Site identity, navigation, SEO, messages, legal/contact content, offerings, sitemap, Lighthouse routes, buyer-facing tests and public Wrangler values were changed to the fictional FieldAxis brief. No product catalog model or runtime service mode was added.

The patch changes 47 files with 975 insertions and 232 deletions. The full patch is stored losslessly in `service-business.patch.gz`.

## Boundary audit

Control-side `git diff --name-only` found no changes under the forbidden inquiry, lead-pipeline, security, email, Airtable, shared test setup, quality-script or release-runner paths. The worktree remained detached at the candidate commit, contained no staged content, and passed `git diff --check`.

## Verification

Passed:

- 8 focused files and 18 focused tests;
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
Tests       38 failed | 1655 passed (1693)
```

Strict public-launch verification exited `1` as expected. It separately reported the `.invalid` domain, fictional contact/phone, pending logo and template R2 values as sentinel blockers, and missing Redis, Turnstile, Resend, Airtable and Cloudflare platform values as environment-readiness blockers.

Playwright, Next build, OpenNext build and Wrangler dry-run were not run because the required full test gate was already red.

## Structural failure

The same six core/API test files hard-code `custom-fabrication` and `Custom Fabrication`. With service-only canonical offerings, validation fails before the tests can reach their intended Turnstile, delivery, failure-propagation and logging branches.

The template must decouple generic inquiry-path tests from its current example offering. Editing the forbidden tests inside the derived site or adding the retired product offering back would invalidate the clean-room proof.

## Additional derivation friction

`message-key-usage` reads tracked files through `git ls-files`, so newly created service pages were invisible until they were marked with `git add -N`. This did not stage file contents, but it is an avoidable clean-room workflow dependency. The template checker should include untracked source files itself or document a proof-safe equivalent; requiring derivators to manipulate the index is not a good default.
