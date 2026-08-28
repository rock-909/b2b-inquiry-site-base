---
paths:
  - "src/proxy.ts"
  - "open-next.config.ts"
  - "wrangler.jsonc"
  - "next.config.ts"
  - "scripts/quality/checks/cloudflare-smoke.js"
---

# Cloudflare / OpenNext Rules

Use this file when changing Cloudflare/OpenNext build, preview, deploy,
proxy, worker config, or Cloudflare-only runtime behavior.

This file contains the repository's Cloudflare/OpenNext choices and proof
requirements, not generic Next.js API guidance.

## Public command surface

Use the existing package scripts and native OpenNext/Wrangler commands listed in
the proof table; do not add phase-named wrappers without a real repeated workflow.

## Proof table

| Change touches | Minimum proof |
| --- | --- |
| Standard Next.js runtime behavior | `pnpm build` |
| Cloudflare/OpenNext build path | `pnpm build` then `pnpm website:build:cf` |
| Local Cloudflare preview behavior | `pnpm exec opennextjs-cloudflare preview --env preview` + `node scripts/quality/checks/cloudflare-smoke.js cf-preview-smoke` |
| Cloudflare deploy-artifact proof | `pnpm exec wrangler deploy --dry-run --env preview` after `pnpm website:build:cf` |
| Deployed Cloudflare behavior | `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url <url>` |
| Public submission routes or compatibility actions | related route/action/IP tests + `pnpm build` + `pnpm website:build:cf` |

Never run `pnpm build` and `pnpm website:build:cf` in parallel. They both write to
`.next`.

## Build ownership

- `pnpm website:build:cf` is the public Cloudflare build command. It minifies
  the production worker by default: `--noMinify` is
  an OpenNext CPU-profiling debug aid, not a production default, and shipping it
  increases the deployed worker size without a production benefit.
- `pnpm website:build:cf:debug` retains the `--noMinify` unminified variant for
  CPU profiling only. Do not point the deploy chain at it.
- Do not use lower-layer or Wrangler minification settings as proof that the
  public OpenNext worker build is safe.
- Use `DEPLOYMENT_PLATFORM=cloudflare` as the canonical Cloudflare signal.

## Runtime entry

Keep `src/proxy.ts` as the runtime entrypoint. Do not restore
`src/middleware.ts` as cleanup.

The exact stable OpenNext dependency owns the Node.js proxy bundling and
instrumentation compatibility path. Keep `nodejs_compat` enabled, and do not
replace the stable package with `pkg.pr.new`, a canary, or a local package patch
without a separate compatibility experiment.

The matcher must remain static string literals.

Any migration branch must use the corresponding build, preview, and deployed
proof rows above.

## Public submission identity

Browser lead submissions go through the `/api/inquiry` route handler only.
Proxy must not inject internal client-IP headers for public form flows.

There is no live `'use server'` Server Action contact path. Any server-side
submission code must validate internally and fail closed when request identity
is unavailable rather than relying on proxy-provided trusted IP headers.

## Cache and runtime bindings

- Do not add `cacheTag()`, `revalidateTag()`, `revalidatePath()`, or
  `updateTag()` to production code without a new Cloudflare proof plan.
- Keep Preview and Production on separate R2 incremental-cache buckets using
  the `NEXT_INC_CACHE_R2_BUCKET` binding.
- Cache Components and Partial Prefetching stay off until a formal stable
  OpenNext release supports them and passes the project runtime proof lanes.
- Do not add production `"use cache"` boundaries without that stable adapter
  support, route-level cache behavior, and deployed Cloudflare proof.
- Content updates flow through rebuild/redeploy.
- Do not add KV, D1, Durable Objects, tag cache, queue overrides, or split
  functions without a separate production requirement and proof plan.

Add platform bindings only for a real requirement, with proof of the deployed
Cloudflare/OpenNext runtime path.
