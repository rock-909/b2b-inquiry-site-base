# Keep preview vars and require the real preview URL in cf-preview-deployed

`node scripts/quality/checks/cloudflare-smoke.js cf-preview-deployed` deployed with `opennextjs-cloudflare deploy --env preview` and no `--keep-vars`. On the real preview Worker that wiped the dashboard-only vars (recipient email, Airtable base, Upstash URL, log level, etc.), and because the committed `env.preview` vars use the placeholder `https://example.invalid` for `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` and `TURNSTILE_ALLOWED_HOSTS`, it also pointed the preview at the placeholder. The command now requires the real preview https URL (`--base-url` or `DEPLOY_SMOKE_BASE_URL`; missing, non-https and `.invalid` values are blocked before any build or deploy), builds with `NEXT_PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL` set to that origin, and deploys with `--keep-vars` plus `--var` overrides for the three URL-dependent vars.

## Actual validation

Before the fix (`pnpm exec vitest run tests/unit/scripts/cloudflare-preview-proof.test.ts` against the previous `cloudflare-smoke.js`, `git show HEAD~1`): 6 failed | 4 passed. Failing cases: deploy args and build env, three invalid-URL blocking cases (no URL, `https://example.invalid`, http non-https), the `DEPLOY_SMOKE_BASE_URL` entry, and deploy-output parsing.

After the fix:

- `pnpm exec vitest run tests/unit/scripts/cloudflare-preview-proof.test.ts`: 10 passed.
- `pnpm exec vitest run tests/unit/scripts`: 254 passed.
- `pnpm exec eslint scripts/quality/checks tests/unit/scripts --max-warnings 0` and `pnpm exec prettier --check` on the changed files: clean.

Real preview proof: `node scripts/quality/checks/cloudflare-smoke.js cf-preview-deployed --base-url https://b2b-inquiry-site-base-preview.faints-pudgier-9r.workers.dev`, with only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` loaded, run under `lockf -k -t 7200 /tmp/fm-b2b-preview-worker.lock`:

- status `pass`; build, deploy and smoke all exit 0.
- Worker binding names, types and secrets before vs after: identical (21 entries, empty diff), so the dashboard-only vars survived.
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` and `TURNSTILE_ALLOWED_HOSTS` (`localhost,127.0.0.1,<preview host>`) equal the real preview URL.

No check beyond the above was run.
