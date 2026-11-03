---
paths:
  - "src/middleware.ts"
  - "open-next.config.ts"
  - "wrangler.jsonc"
  - "next.config.ts"
  - "scripts/quality/checks/cloudflare-smoke.js"
---

# Cloudflare / OpenNext Rules

Use this file when changing Cloudflare/OpenNext build, preview, deploy,
middleware, worker config, or Cloudflare-only runtime behavior.

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
| Cloudflare deploy-artifact proof | `pnpm exec wrangler deploy --dry-run --env preview` after `pnpm website:build:cf` and `pnpm exec opennextjs-cloudflare populateCache local --env preview` and `node scripts/quality/checks/cloudflare-artifact-config.js --static-assets-cache` (`opennextjs-cloudflare deploy`/`preview` populate it themselves; plain `wrangler deploy` does not, and a build that skipped populate still passes dry-run and smoke) |
| Deployed Cloudflare behavior | `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url <url>` |
| Public submission routes | related route/action/IP tests + `pnpm build` + `pnpm website:build:cf` |

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

`src/middleware.ts` (edge runtime, `export function middleware`) is the runtime
entrypoint. The reason, the expected Next.js 16 deprecation warning, and the
conditions for moving back to `src/proxy.ts` are in
[技术栈](../../docs/技术栈.md#cloudflare-能力评估2026-10-17) (中间件入口); a move
back uses the build, preview, and deployed proof rows above. Keep the middleware
to Web APIs; do not add Node.js-only imports to it.

Keep `nodejs_compat` enabled, and do not replace the stable OpenNext package
with `pkg.pr.new`, a canary, or a local package patch without a separate
compatibility experiment.

The matcher must remain static string literals.

Any migration branch must use the corresponding build, preview, and deployed
proof rows above.

## Public submission identity

Middleware must not pass identity, client IP, or auth decisions to public write
flows; see [Server-only code](security.md#server-only-code).

## Cache and runtime bindings

- The incremental cache is OpenNext's read-only Static Assets cache
  (`open-next.config.ts`); `wrangler.jsonc` binds no R2 bucket. Only a derived
  site that needs runtime revalidation switches back to R2, with separate
  Preview and Production buckets (`NEXT_INC_CACHE_R2_BUCKET`).
- Do not add a tag cache, queue overrides, or split functions to
  `open-next.config.ts` without a separate production requirement and proof
  plan.
- Code-level cache APIs and KV, D1, or Durable Objects are governed by the
  Cache section of [conventions.md](conventions.md#cache).

Add platform bindings only for a real requirement, with proof of the deployed
Cloudflare/OpenNext runtime path.
