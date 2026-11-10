---
paths:
  - "src/app/**/*.{ts,tsx}"
  - "src/lib/content/**"
  - "src/middleware.ts"
  - "next.config.ts"
---

# Next.js Runtime Rules

This file contains project-specific Next.js choices, not generic framework API
guidance.

## App Router

- This repo uses the installed Next.js App Router.
- Use the installed async request API shape for page/layout request props.
- Locale URL, metadata and language-addition contracts are owned by `i18n.md`;
  do not maintain a second routing policy here.

## Client boundaries and lazy loading

- Keep static marketing sections, page copy, proof sections, product narrative,
  and footers as Server Components by default.
- Push `"use client"` to the smallest interactive leaf. Do not make a whole
  section a Client Component only for minor animation or convenience.
- Use lazy loading only for heavy, non-critical client code that is not needed
  to understand the first render.
- Do not add broad `next/dynamic` or `React.lazy()` wrappers as a default
  performance tactic.

## Preserved route state

Shared client islands under persistent layouts follow
[Shared island state](ui.md#shared-island-state) in `ui.md`.

## Error boundaries

Add route-level `error.tsx` when a route needs its own recovery UI. Currently
`contact` has one; the other current pages rely on the global fallback.
The inquiry form handles expected validation and provider failures locally.
Do not add another boundary solely because a route has parameters or a form.

User-interaction-triggered lazy loading is the exception: an `import()` island
(`ActivatedIsland`, no Suspense) that loads on hover or click (mobile navigation,
language menu) sits under a `[locale]` layout, so a failed `import()` would
otherwise reach `global-error` and replace the whole page. Wrap each such island
in `LazyIslandBoundary` and fall back to usable static markup (the island's
no-JS fallback, or static links). Do not rely on `retry` — the rejected `import()`
is cached, so only a page reload retries the chunk.

## Cache

- Use `React.cache()` for request-level dedupe only.
- Reserve `*Cached` suffix for exported helpers that actually define a cache
  boundary.
- Content updates flow through rebuild/redeploy.
- Do not add `cacheTag()`, `revalidateTag()`, `revalidatePath()`, or
  `updateTag()` to production code without a new Cloudflare proof plan.
- Do not add new `unstable_cache` usage or production `"use cache"` boundaries
  without stable OpenNext adapter support, route-level cache behavior, and
  deployed Cloudflare proof.
- Cache Components and Partial Prefetching stay off until a formal stable
  OpenNext release supports them and passes the project runtime proof lanes.
- Do not add KV, D1, or Durable Objects without a separate production
  requirement and proof plan.

## Route addition

`src/middleware.ts` rewrites every path outside its known-path allowlist to a
404. Static pages join it through `src/config/pages.config.ts`; a new dynamic
route (for example `/products/[slug]`) must add its own match in the middleware,
or it will 404.

## Route deletion checklist

When removing a route:

1. Delete the route directory under `src/app/[locale]/`.
2. For a static page, remove its `src/config/pages.config.ts` entry and its
   `src/content/pages/<locale>/` modules with their `src/lib/content/static-pages.ts`
   registrations; sitemap, navigation, and the middleware allowlist follow from
   `pages.config.ts`. For a dynamic route, also remove its middleware match,
   sitemap and `/llms.txt` entries, and param helper.
3. Remove or update tests.
4. Run `pnpm type-check`.
