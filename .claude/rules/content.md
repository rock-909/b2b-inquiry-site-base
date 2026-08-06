---
paths:
  - "content/**/*"
  - "messages/**/*.json"
  - "src/config/single-site*.ts"
  - "src/constants/tucsenberg-product-page-*.ts"
  - "src/constants/tucsenberg-product-pages.ts"
  - "src/lib/content/**"
  - "src/lib/content-query/**"
  - "src/app/**/page.tsx"
---

# Content Rules

Use this file when editing MDX content, page frontmatter, SEO metadata, FAQ
content, shared UI text, or single-site identity/config.

## Authoring sources

Every content field has one authoring source.

| If changing | Edit | Do not edit |
| --- | --- | --- |
| Company-wide facts | `src/config/single-site.ts` | MDX prose |
| Page prose, FAQ, page SEO | `content/pages/{locale}/*.mdx` | Translation JSON |
| Page structure switches | `src/config/single-site-page-expression.ts` | MDX body copy |
| Crawl/indexing policy | `src/config/single-site-seo.ts` | Page components |
| Shared labels/nav/buttons/form chrome | `messages/base/**`, `messages/profiles/b2b-lead/**`, `messages/profiles/catalog/**` | MDX frontmatter |
| Product specifications and reviewed product-page copy | `src/constants/tucsenberg-product-page-*.ts` | Component literals or translation JSON |
| Reusable catalog/card data | typed config + i18n namespace | page prose only |

## Page content

- Page titles, descriptions, FAQ items, and legal/About prose live in MDX
  frontmatter/body.
- FAQ belongs to the page that renders it. Do not create a shared FAQ pool.
- Home is a structured campaign landing exception: current section order and
  reusable section copy can stay in config/i18n.
- Generated workflow/plan context under root `plans/**` can explain work,
  but it is not a content authoring source.
