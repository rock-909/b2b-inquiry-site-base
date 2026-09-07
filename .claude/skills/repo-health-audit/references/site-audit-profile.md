# Site Audit Profile

Use this as the repo-specific audit adapter. It overrides any global
legacy starter profiles that do not describe this repository.

## Critical chains

1. Offering discovery: offering truth -> public page -> SEO metadata ->
   JSON-LD -> sitemap -> CTA.
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
  - `messages/base/{locale}/messages.json`
  - `.claude/rules/i18n.md`
- Launch/release proof:
  - `docs/派生项目交接.md`
  - `docs/质量门禁.md`
- Canonical offering and route truth:
  - `src/config/pages.config.ts`
  - `src/config/single-site*.ts`
  - `src/config/offerings.ts`
  - content config used by active pages

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
