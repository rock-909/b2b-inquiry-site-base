# First neutralization report

- Donor SHA: `dcb9e2bbed164b484e1c8cbc1b08c7f140e84405`
- Neutralization input SHA: `4198274e0c88c054049afd54d19bdaa50d1422d5`
- Candidate implementation SHA: `f7b4a0f81de44e60b04043b3e813287afbc117df`
- Verified on: `2026-08-06`
- Current status: `INDEPENDENT_NEUTRAL_BASE_CANDIDATE`

## Moved out in this pass

- `public/downloads/**`
- Legacy branded image files under `public/images/`
- Legacy branded App Router icon and favicon assets.
- Donor-specific CODEOWNERS and historical business decision notes.
- Old `/downloads/*.pdf` noindex probes in Cloudflare smoke, E2E smoke, Next headers, `_headers`, Lighthouse/header-related proof surface.

All file removals in this pass used `/usr/bin/trash`; no permanent delete command was used.

## Technical lines retained

- Next.js App Router reference pages: `/about`, `/contact`, `/request-quote`, plus shared static pages and form flow.
- OpenNext/Cloudflare build and deploy proof chain.
- Cloudflare static asset header proof, narrowed to the generic `/_next/static/*` long-cache rule only.
- Inquiry form, Turnstile/Airtable/Resend runtime path.

## Verification run

- `pnpm install --frozen-lockfile` — PASS.
- `pnpm type-check` — PASS.
- `pnpm type-check:tests` — PASS.
- `pnpm lint:check` — PASS.
- `pnpm test` — PASS, 221 files and 1689 tests.
- `pnpm content:check` — PASS.
- `pnpm knip:check` — PASS.
- `pnpm exec playwright test --project=chromium` — PASS, 65 passed and 1 skipped.
- `pnpm build` — PASS with Next.js `16.3.0`.
- `pnpm website:build:cf` — PASS with `@opennextjs/cloudflare` `1.20.2`.
- `pnpm exec wrangler deploy --dry-run --env preview` — PASS.
- `node scripts/starter-checks.js cf-static-asset-headers` — PASS against source and built assets.
- Source, public asset and `.open-next/assets` legacy residue scans — no results.

## Public-launch sentinel proof

`PUBLIC_LAUNCH_STRICT=true APP_ENV=production NODE_ENV=production node scripts/starter-checks.js validate-production-config`
exited non-zero as required.

- Sentinel blockers: starter identity, domain, email, phone, SEO defaults, logo readiness, Worker name and preview/production R2 bucket names remain intentionally unresolved.
- Environment readiness blockers: production Redis, rate-limit pepper, Turnstile, Resend, Airtable and Cloudflare platform values remain unconfigured.

The sentinel blockers prove that this repository cannot be mistaken for a client-ready public launch. Missing secrets and bindings are tracked separately and do not substitute for sentinel proof.

## Remaining caveats

- Clean-room rewrite review: not done.
- Mutation proof: not done.
- Real owner acceptance / public launch evidence: not done.
