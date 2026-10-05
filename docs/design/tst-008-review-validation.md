# TST-008 review validation

R1 fixes the shared preview-proof subprocess boundary: timing out a pnpm wrapper must also stop its descendants, so abandoned builds or deploys cannot continue after a failed proof. Commit lookup, build, deploy, and smoke now await the same process-group runner. Captured output remains limited to 64 MiB; timeout results retain `ETIMEDOUT` and `SIGKILL`.

This record supplies the review executor with the required reproduction and verification evidence.

## Before the fix

Ran a Node heredoc importing `runChildCommand` and invoking `sh -c '"$1" -e "$2" "$3" >/dev/null 2>&1 & wait'` with a Node grandchild scheduled to write a worktree-local marker after 800 ms and a 300 ms command timeout. After another 1000 ms, the assertion failed (exit 1): `{"code":"ETIMEDOUT","descendantWroteAfterTimeout":true}`. The fixture was removed afterward.

## After the fix

- `pnpm install --frozen-lockfile` — passed before editing or testing.
- `pnpm exec vitest run tests/unit/scripts/cloudflare-preview-proof.test.ts` — passed, 4 tests, including the wrapper/grandchild delayed-side-effect regression.
- `pnpm exec vitest run tests/unit/scripts` — passed, 18 files / 171 tests.
- `pnpm exec eslint scripts/quality/checks/cloudflare-smoke.js tests/unit/scripts/cloudflare-preview-proof.test.ts` — passed.
- `pnpm exec prettier --check scripts/quality/checks/cloudflare-smoke.js tests/unit/scripts/cloudflare-preview-proof.test.ts` — passed.

No build, deployment, full repository suite, push, PR, or CI phase was executed.
