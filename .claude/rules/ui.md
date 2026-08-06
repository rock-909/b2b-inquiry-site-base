---
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "src/**/*.stories.tsx"
---

# UI Rules

Use this file when creating or changing components, sections, form UI, design
tokens, Tailwind classes, images, or fonts.

## Reuse first

Before creating a component, check existing folders:

```text
src/components/ui
src/components/sections
src/components/forms
src/components/products
src/components/layout
src/components/navigation
src/components/footer
src/components/contact
src/components/content
src/components/grid
src/components/errors
src/components/cookie
src/components/security
src/components/seo
src/components/monitoring
```

Decision order:

1. Reuse an existing component.
2. Add a variant when the concept is the same.
3. Compose a business component only when there is real business meaning.
4. Keep one-off page UI local.
5. Add a new `src/components/ui/` primitive only with a clear current need and
   tests when behavior exists.

Use project wrappers in `src/components/ui/` instead of importing Radix
primitives directly from page sections or business components.

External UI references such as shadcn are references only; project-approved UI
lives in adapted local wrappers under `src/components/ui/*`.

## Radix UI foundation

The project uses local UI wrappers plus Radix Primitives.

- Radix Primitives are approved for complex interactions.
- Tailwind and project tokens own controls, page layout, responsive structure,
  and brand expression.
- Runtime color truth remains in `src/app/globals.css`.
- `@radix-ui/themes` is retired and forbidden in production UI.

Business code must import UI from local wrappers, for example
`@/components/ui/*`.

Do not:

- import, dynamically import, or require `@radix-ui/themes` anywhere in
  production UI;
- style `.rt-*` classes or depend on Radix internal DOM;
- use `!important` to solve Radix/Tailwind conflicts;
- keep empty compatibility wrappers for retired vendor boundaries.

Use Radix Primitive-backed wrappers for genuinely complex interaction. Use
native HTML plus Tailwind and project tokens for ordinary inputs, textareas,
badges, status panels, cards, narrative UI, and page layout.

Use this judgment split:

- Complex focus, keyboard, overlay, selection, or disclosure behavior: prefer
  governed Radix Primitive wrappers.
- Straightforward native form and semantic HTML behavior: prefer local wrappers.
- Marketing/storytelling surfaces: prefer Tailwind, project tokens, and local
  section composition.
- Form controls are native HTML with project tokens. The current
  `src/components/ui` surface should contain only wrappers that a page imports.
- Replacing live native form controls with wrappers must preserve FormData,
  labels, no-JS fallback, state, and stable user-facing locators.

## Mobile navigation boundaries

Keep mobile navigation interaction state inside the smallest client island. Do
not turn the whole header, navigation shell, or static fallback into a Client
Component only to support drawer state.

When changing header or mobile navigation, preserve the server-rendered/no-JS
fallback, accessible labels, stable links, and the smallest client boundary.

## Header and shared island state

Header, language switcher, mobile sheet, dropdown menu, route progress, and
similar shared UI must keep interaction state inside the smallest client island.

Do not rely on route unmounting to close shared UI. If a stateful surface should
close after navigation, bind its open state to the route identity or derive the
closed state from the current pathname.

For lazy-loaded stateful UI:

- keep the server/no-JS fallback stable;
- record where the user activation happened when `initialOpen` or pending UI is
  used;
- do not let a late-loaded island open on a different route;
- preserve accessible labels and stable locators.

Do not move the whole header or layout to a Client Component just to reset
dropdown, drawer, or progress state.

## Design tokens

Design values live in `src/app/globals.css`.

- Use semantic tokens such as `bg-primary`, `text-foreground`, `border-border`,
  `ring-ring`, or explicit CSS variable classes.
- Do not add raw brand hex values in browser UI.
- Do not add raw Tailwind palette classes in production UI unless the class is
  inside a test fixture.
- If a new visual state is needed, add or reuse a semantic token.
- `src/config/static-theme-colors.ts` is only for email and other non-CSS
  surfaces.

Brand color, theme, token structure, and page-level visual patterns are design
decisions. Ordinary section H2 uses `.text-section` via `SectionHead`.

## Tailwind CSS v4

Tailwind config is in `@theme inline` inside `globals.css`; there is no
`tailwind.config.ts`.

Do not build class names through string interpolation. Use literal maps or
inline style for truly dynamic values.

Use `cn()` from `@/lib/utils` for conditional classes.

## Motion and first render

- Motion must not turn large static marketing sections into Client Components
  without measurable value.
- Prefer CSS transitions or server-rendered static structure for decorative
  reveal effects when the content is otherwise static.
- Do not add a motion dependency for decorative reveal; require before/after
  evidence and a current buyer-facing need before adding branded motion.
- Always preserve `prefers-reduced-motion` behavior when changing animation.

## Images, fonts, metadata

- Default to `next/image` for buyer-visible app images.
- Native `<img>` is acceptable only when optimization is intentionally skipped
  or unsupported.
- For above-the-fold images, prefer the current `next/image` preload model over
  older `priority` examples.
- Treat image preload as an LCP decision. Do not preload multiple competing
  images without route-level evidence.
- Do not remove the Cloudflare `images.unoptimized` baseline or add a custom
  image loader without a separate deployed Cloudflare image proof.
- Do not add Cloudflare Images, Transformations, remote image domain expansion,
  or custom loaders as project defaults without separate deployed proof.
- `next/font/local` is the safe default for branded fonts. Avoid adding runtime
  font network dependencies for buyer-visible pages.
