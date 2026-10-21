---
paths:
  - "messages/**/*.json"
  - "src/content/**/*"
  - "src/config/single-site*.ts"
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
| Page route, content slug, main navigation, and footer navigation column | `src/config/pages.config.ts` (`navigationKey` selects pages in definition order); main-navigation sub-menus (`groups`) in `src/config/single-site-navigation.ts` | Page modules or independent navigation lists |
| Crawl/indexing policy | `src/config/single-site-seo.ts` | Page components |
| Shared labels/nav/buttons/form chrome | `messages/base/{locale}/messages.json` | Page metadata |

派生站新增业务页面时，应明确其内容来源并提供各语言的完整正文，不以默认语言内容冒充本地化页面。

## Page content

- Page titles, descriptions, FAQ items, and legal prose (and any derived business-page prose) live in the
  locale's static page module.
- FAQ belongs to the page that renders it. Do not create a shared FAQ pool.
- Home is a minimal entry page: its short localized copy stays in i18n.
- Generated workflow/plan context under root `plans/**` can explain work,
  but it is not a content authoring source.
