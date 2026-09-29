# COR-003 review fixes

- R1: Replaced the inert language error fallback with the existing native details/link pattern and shared current-page locale URL helper. Mobile navigation and inquiry fallbacks are unchanged.
- R2: Removed two implementation-source assertions and their unused file-reading import; retained behavioral header tests.

## Executed verification

- `pnpm install --frozen-lockfile`: passed.
- Before the production fix, `pnpm exec vitest run src/components/layout/__tests__/header-client-load-failure.test.tsx`: failed as expected (two language cases failed because the disclosure was missing; mobile fallback passed).
- After all fixes, `pnpm exec vitest run src/components/layout/__tests__/header-client-load-failure.test.tsx src/components/layout/__tests__/header-client.test.tsx`: passed, 12 tests. Covers click/hover rejection, both configured locale links, pathname/query/hash preservation, subsequent route updates, and normal island behavior.
- `pnpm react:doctor`: passed with zero errors and warnings. Although invoked through the project's changed-scope command, the tool reported a full scan of 438 files.

No complete test suite, repository lint suite, push, PR, or CI phase was run.
