---
paths:
  - "src/lib/structured-data*.ts"
  - "src/components/seo/**"
  - "src/app/**/page.tsx"
  - "src/app/**/*jsonld.ts"
  - "src/app/**/*page-data.ts"
  - "src/content/pages/**/*.ts"
---

# Structured Data / JSON-LD Rules

Schema objects are built through `src/lib/structured-data-generators.ts`.

Pages and component shells render generated nodes through `<JsonLdGraphScript>`;
generators return context-free nodes, and the graph renderer supplies the single
top-level `@context`. Do not pass standalone nodes directly to `<JsonLdScript>`
or hand-roll schema objects inline; `<JsonLdScript>` only serializes and escapes
its input.

## Rendering and escaping

Render JSON-LD through the shared SEO script components. Do not use page-local
`JSON.stringify` inside inline scripts.

If a new JSON-LD script shape is needed, add it to the shared renderer and keep
escaping behavior covered by tests.

## Injection points

- Shared graph: `JsonLdGraphScript` merges stable `#organization` and `#website`
  identity nodes with page-specific schemas on pages that render structured data.
  Organization and its references are omitted when valid company facts are absent;
  do not require company details merely to populate schema.
- Page: page-specific schemas such as FAQPage, Article, Product, WebPage,
  ItemList, and BreadcrumbList.
- Component shell: only when the shell owns page-level rendering, and the
  schema still comes from the shared generators.

## Public page schema coverage

When changing public page schema output, keep focused tests for the expected
schema types.

There are no default product routes. If a derived site adds product detail
pages that represent one catalog item, they should emit a single
`Product` node plus supporting graph nodes such as `BreadcrumbList` and
`FAQPage` when those concepts apply.

This is an inquiry site: products are quoted, not sold at public prices, so
product pages do not pursue Google product rich results. Do not invent
`offers`, prices, `review` or `aggregateRating` to satisfy the product snippet
requirements. Search Console product snippet warnings or invalid items on
product pages are expected, not defects.
