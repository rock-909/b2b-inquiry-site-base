# Review fix verification and commit-body handoff

This record supersedes the earlier commit text in `17e75d4` claiming that build scripts are parsed or that extra flags/environment prefixes are accepted. The final implementation uses exact canonical script comparison for both production and debug builds. Only the hard-coded OpenNext version number was replaced with an exact-stable version policy.

## Review findings

- R1 confirmed: the deployment output substring assertion could pass without emitting any output, and the shell-source prohibition did not prove safe execution. Replaced both with execution-based coverage. The deployment and resolution scripts run with controlled substitutes and separate fixture `GITHUB_OUTPUT` files; tests assert actual `worker-url` and `deployment-url` records. Semantic YAML bindings and hostile-URL post-deploy execution checks remain.
- R2 confirmed: historical parser verification is not evidence for the final implementation. The results below are fresh runs in this worktree. The outer executor must include this correction and its own validation results in the fix commit body.

## Actual commands and results

- `pnpm install --frozen-lockfile`: exit 0, before edits or tests.
- `pnpm exec prettier --write tests/architecture/deploy-workflow-contract.test.ts`: exit 0, unchanged.
- `pnpm exec vitest run tests/architecture/deploy-workflow-contract.test.ts tests/unit/scripts/cloudflare-config-check.test.ts`: exit 0; 2 files, 48 tests passed (19 workflow, 29 configuration).

Negative-check evidence in that focused run: for each of the deployment and resolution stages, the test substitutes a successful shell no-op (`:`) for the selected script. The same output assertion used by the real-script test throws because the required output is absent; both negative controls passed by observing that failure. The active workflow was not mutated. The real scripts passed for an ordinary URL and a URL containing command substitutions, backticks, and a quote, without creating marker files. Existing post-deploy hostile-URL checks also passed.

## Remaining executor-owned validation

`pnpm type-check` and `pnpm lint:check` were deliberately not run in this review-fix phase: the phase boundary reserves those gates for the outer executor and forbids the full lint suite here. No current success is claimed for either command. The outer executor must run them and append their actual results to the fix commit body; this record is not a substitute for those gates. No commit, push, PR, CI, or deployment operation was performed here.
