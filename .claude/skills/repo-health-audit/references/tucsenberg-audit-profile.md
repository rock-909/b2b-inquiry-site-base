# Tucsenberg Audit Profile

Use this as the repo-specific audit adapter. It overrides any global
`ai-smell-audit` repo profile that still mentions Showcase Website Starter.

## Critical chains

1. Product discovery: product truth -> catalog -> product detail page -> SEO
   metadata -> JSON-LD -> sitemap -> CTA.
2. Buyer inquiry: form -> `/api/inquiry` -> validation -> Turnstile -> rate
   limit -> lead pipeline -> owner email + Airtable -> buyer feedback.
3. Release proof: source -> messages/content -> Next build -> OpenNext build ->
   Cloudflare Worker -> deployed smoke -> real lead canary -> owner receipt.

## Read early

- Inquiry, lead, and security:
  - `src/app/api/inquiry/route.ts`
  - `src/components/forms/**`
  - `src/lib/lead-pipeline/**`
  - `src/lib/security/**`
  - `.claude/rules/security.md`
- Messages:
  - `messages/base/**`
  - `messages/profiles/b2b-lead/**`
  - `messages/profiles/catalog/**`
  - `.claude/rules/i18n.md`
- Launch/release proof:
  - `docs/正式上线标准.md`
  - `docs/开发与维护.md`
  - `docs/架构与行为.md`
- Canonical product and route truth:
  - `src/config/pages.config.ts`
  - `src/config/single-site*.ts`
  - `src/constants/tucsenberg-product-pages.ts`
  - `src/constants/tucsenberg-product-page-*.ts`

## Noise to classify first

- generated output: `.next/**`, `.open-next/**`, `.wrangler/**`
- local scratch: `.codex/.tmp/**`, `.omx/**`
- old starter/profile references that are not active runtime, rules, tests, or
  current docs

## Proof split

- `pnpm build` is local Next proof.
- `pnpm website:build:cf` is Cloudflare/OpenNext build proof.
- `pnpm release:verify` is local release proof, not public launch proof.
- deployed smoke and real lead canary are separate proof levels.
