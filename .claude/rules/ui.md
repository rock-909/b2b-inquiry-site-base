---
paths:
  - "src/components/**/*.{ts,tsx}"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "src/app/theme.css"
  - "src/app/globals.css"
  - "src/**/*.stories.tsx"
  - "components.json"
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

Use project wrappers in `src/components/ui/` instead of importing Base UI
directly from page sections or business components.

External UI references such as shadcn are references only; project-approved UI
lives in adapted local wrappers under `src/components/ui/*`.

## Base UI foundation

The project uses local UI wrappers plus Base UI for complex interactions.

- Base UI is approved for complex focus, keyboard, overlay, disclosure, and
  selection behavior.
- Tailwind and project tokens own controls, page layout, responsive structure,
  and brand expression.
- `src/app/theme.css` is the website theme entry. `src/app/globals.css` imports
  it and owns the Tailwind adapter and global behavior.

Business code must import UI from local wrappers, for example
`@/components/ui/*`.

Do not:

- import Base UI directly outside `src/components/ui/*`;
- depend on Base UI internal DOM beyond its documented public attributes and
  CSS variables;
- use `!important` to solve Base UI/Tailwind conflicts;
- keep empty compatibility wrappers for retired vendor boundaries.

Use Base UI-backed wrappers for genuinely complex interaction. Use
native HTML plus Tailwind and project tokens for ordinary inputs, textareas,
badges, status panels, cards, narrative UI, and page layout.

Use this judgment split:

- Complex focus, keyboard, overlay, selection, or disclosure behavior: prefer
  governed Base UI wrappers.
- Straightforward native form and semantic HTML behavior: prefer local wrappers.
- Marketing/storytelling surfaces: prefer Tailwind, project tokens, and local
  section composition.
- Form controls are native HTML with project tokens. The current
  `src/components/ui` surface should contain only wrappers that a page imports.
- Replacing live native form controls with wrappers must preserve FormData,
  labels, no-JS fallback, state, and stable user-facing locators.

Base UI composition uses `render`. The rendered component must pass Base UI
props and `ref` through to its final DOM element. Link CTAs stay links and call
the shared variant function such as `buttonVariants()` directly.

Base UI state attributes such as `data-open` and `data-closed`, plus its
positioning and sizing CSS variables, are runtime interaction data. They are
not brand design tokens.

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

Website design values live in `src/app/theme.css`.

- For an overall derived-site restyle, start with `theme.css`.
- For component structure or variants, change `src/components/ui/*`.
- For a page-specific design, change that page or its domain component.
- Tokens are the convenient first entry for Agents, not a restriction against
  changing components or pages when the design requires it.

- Use semantic tokens such as `bg-primary`, `text-foreground`, `border-border`,
  `ring-ring`, or explicit CSS variable classes.
- Components may use semantic roles and the small set of global visual-feel
  tokens in `theme.css`; they must not consume raw visual materials directly.
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
`tailwind.config.ts`. This block adapts values from `theme.css` and must not
become a second theme source.

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
