---
paths:
  - "src/app/**/*.{ts,tsx}"
  - "src/lib/content/**"
  - "src/proxy.ts"
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
- Keep layouts and non-interactive sections as Server Components.
- Push `"use client"` down to interactive leaf components.

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

Shared Client Components under layouts, headers, navigation, progress bars,
cookie/attribution islands, or other persistent shells must not assume they
unmount on App Router navigation.

When a shared client island owns open, pending, expanded, selected, or progress
state:

- tie the state to the route identity when it should reset after navigation;
- derive closed or inactive state during render when possible instead of
  copying it through `useEffect`;
- use the real browser pathname from `next/navigation` when route identity
  matters;
- treat same pathname plus same search as the same route for route-progress UI;
- do not treat hash-only changes as route navigation.

For lazy client islands opened by user intent, do not pass stale `initialOpen`
or pending state after navigation. Store the pathname where activation happened
and only auto-open when the current pathname still matches.

## Error boundaries

Add route-level `error.tsx` when a route needs its own recovery UI. Currently
`contact` has one; product and static content pages rely on the global fallback.
The inquiry form handles expected validation and provider failures locally.
Do not add another boundary solely because a route has parameters or a form.

## Cache

- Use `React.cache()` for request-level dedupe only.
- Production cache boundaries and tag invalidation require Cloudflare/OpenNext
  runtime proof.
- Reserve `*Cached` suffix for exported helpers that actually define a cache
  boundary.
- Do not add new `unstable_cache` usage or Cache Components without separate
  Cloudflare/OpenNext proof.

## Route deletion checklist

When removing a route:

1. Delete the route directory under `src/app/[locale]/`.
2. Remove path/config entries.
3. Remove sitemap generation for the route.
4. Remove navigation links.
5. Remove param helpers.
6. Remove or update tests.
7. Run `pnpm type-check`.
