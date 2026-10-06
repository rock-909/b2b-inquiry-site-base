# R2 review fix evidence

The unified inquiry adapter migration left six test files using removed input projections. These fixtures could fail before reaching prepared provider responses. This round changes tests only: schema-output fixtures plus reference IDs, provider-call assertions, and owner-format assertions on actual adapter output.

Commands run in this worktree:

- `pnpm install --frozen-lockfile` — passed.
- The focused command below before edits — 6 files failed; 26 tests failed, 18 passed. Failures reproduced stale adapter inputs and pipeline expectations.
- `pnpm exec prettier --write` on the six files below — completed.
- The same focused command after all edits — 6 files passed; 46 tests passed.

```sh
pnpm exec vitest run src/lib/airtable/service-internal/lead-records.test.ts src/lib/__tests__/resend.test.ts src/lib/email/__tests__/runtime-email-content.test.ts src/lib/lead-pipeline/__tests__/multiline-lead-fields.test.ts src/lib/lead-pipeline/__tests__/process-lead.test.ts src/lib/__tests__/cloudflare-runtime-env.test.ts
```

Production behavior is unchanged. Full type checks, lint, and the main-versus-target owner-contract render comparison were not run in this bounded review-fix phase; those remain with the outer executor. The focused tests prove current rendering, formula guards, empty-message output, provider-error execution, and delivery forwarding, not byte-identical output against main.
