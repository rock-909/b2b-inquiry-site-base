---
paths:
  - "messages/**/*.json"
  - "src/content/**/*"
  - "src/config/single-site*.ts"
  - "src/config/offerings.ts"
  - "src/lib/content/**"
  - "src/lib/content-query/**"
  - "src/app/**/page.tsx"
---

# Content Rules

Use this file when editing static page content, SEO metadata, FAQ
content, shared UI text, or single-site identity/config.

## Authoring sources

Every content field has one authoring source.

| If changing | Edit | Do not edit |
| --- | --- | --- |
| Company-wide facts | `src/config/single-site.ts` | Page prose |
| Page prose, FAQ, page SEO | `src/content/pages/{locale}/*.ts` | Translation JSON |
| Page route and content slug ownership | `src/config/pages.config.ts` | Page modules |
| Crawl/indexing policy | `src/config/single-site-seo.ts` | Page components |
| Shared labels/nav/buttons/form chrome | `messages/base/{locale}/messages.json` | Page metadata |
| Offering names and reviewed offering copy | `src/config/offerings.ts` and active content | Component literals or translation JSON |

## Page content

- Page titles, descriptions, FAQ items, and legal/About prose live in the
  locale's static page module.
- FAQ belongs to the page that renders it. Do not create a shared FAQ pool.
- Home is a structured campaign landing exception: current section order and
  reusable section copy can stay in config/i18n.
- Generated workflow/plan context under root `plans/**` can explain work,
  but it is not a content authoring source.
