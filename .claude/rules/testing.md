---
paths:
  - "**/*.{test,spec}.{ts,tsx}"
  - "tests/**/*"
---

# Testing Rules

Use this file when adding or changing tests, mocks, fixtures, or behavior proof.

## Proof selection

| Change type | Preferred proof |
| --- | --- |
| User-visible behavior | the smallest focused proof at the layer where the behavior is observed |
| Pure utility logic | unit test |
| Public form submission | validation rejection + happy path + anti-abuse proof |
| Route/navigation/locale behavior | route-level integration or browser test |
| Schema validation | real validator by default; mock only for adapter wiring |
| Component DOM/prop change | update the closest behavior proof when the change affects a real contract |
| Client Component, hook, or React behavior change | focused behavior test |

## Assertions

Assertions must protect observable behavior or a live risk and must fail when
that behavior breaks.

- Exercise the real subject rather than a mock that recreates its behavior.
- Use expected values independent from the value under test.
- Parse structured input as structured data instead of matching substrings.
- Assert complete sequences when order or count matters; do not inspect only the
  first and last state.
- Validate input types before coercion; normalization must not hide malformed
  configuration.
- Cover no-JS, responsive, locale, or failure branches only when they carry
  distinct required behavior.
- Do not protect exact prose, file layout, counts, deleted names, or historical
  refactors unless they are a current external contract.

Use a deliberate negative check when an assertion is new, surprising, or
replacing another protection. Full mutation testing is optional.

## Coverage ownership

Before saying another test or gate covers a removed check, confirm that it:

- reaches the same behavior and failure mode;
- runs in the intended pipeline;
- fails that pipeline with blocking severity.

Use `git show <ref>:<path>` or a temporary worktree to inspect a baseline. Do
not rewrite the active worktree to measure it. Report counts only when freshly
measured; never turn them into permanent rules.

A gate must have a timeout, measure a fresh artifact, and fail on unsafe
production switches. Flake checks must not retry themselves green.

Heavy mutation and broad review lanes are opt-in only.

## Performance proof

- Performance changes need before/after evidence.
- Match the proof to the risk: bundle or transfer size for payload changes,
  page-level measurement for user experience, and render evidence for Client
  Component behavior.
- Do not relax thresholds, remove business content, or add broad lazy loading
  only to improve a metric.
- Revert optimizations whose measured gain does not justify their complexity.

## Reliability

- Avoid wall-clock thresholds in unit and integration tests.
- Browser tests should use observable-state assertions instead of fixed waits.
- UI tests must create the state they assert against.
- Critical smoke and E2E tests must fail on runtime errors.
- Tests named integration, contract, or protection must not mock away the core
  proof path.
- Console warning or error suppression must include a narrow reason.

## Navigation and browser proof

For shared client islands whose behavior depends on navigation, create the
state, navigate, and assert the user-visible state that must persist or reset.
Add back/forward, locale, or hash cases only when the behavior depends on them.

Prefer user-facing locators. Use `getByTestId()` only when those locators are not
practical. Avoid CSS class selectors for user flows.

## Validation and mocks

Schema rejection tests use the real validator. A narrow adapter-wiring test may
mock a schema object only when it does not claim to prove validation.

Use shared test utilities instead of duplicating mock systems:

- `@/test/utils`
- `@/test/i18n-messages`

Test translations come from the same composed message graph as production.
When locales are added, extend that fixture/composition map instead of adding a
hand-written catalog. Local translation mocks are allowed only for explicit
mock-wiring tests.

`src/test/__tests__/mock-translations.test.ts` protects two required behaviors:

- a real empty-string message remains empty;
- overriding a key absent from the real packs throws.

## Skips

Avoid committed skips. If a narrow skip is unavoidable, state the reason;
prefer `test.todo` for planned behavior.
