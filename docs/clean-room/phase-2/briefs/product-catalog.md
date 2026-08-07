# Product catalog clean-room brief

## Fixed source

- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario verdict must be based on a detached worktree created from that commit.

## Company facts

- Public name: `Northline Process Equipment`
- Legal name: `Northline Process Equipment LLC`
- Domain: `https://northline-process.example.invalid`
- Email: `sales@northline-process.example.invalid`
- Phone: `+1 555 014 1200`
- Location: `Dayton, Ohio, United States`
- Positioning: compact process equipment for maintenance teams, pilot lines and temporary production needs.
- Primary CTA: `Request a product quote`

The company, domain and contact details are fictional. The `.invalid` domain and missing production providers must keep strict public-launch verification red.

## Offerings

| ID | Name | Buyer need |
| --- | --- | --- |
| `compact-transfer-pump` | Compact Transfer Pump | Move water-like and light process fluids between tanks or production steps. |
| `chemical-dosing-skid` | Chemical Dosing Skid | Add a controlled chemical feed package without designing a full system from scratch. |
| `mobile-filtration-unit` | Mobile Filtration Unit | Filter temporary process streams during maintenance, trials or recovery work. |

`src/config/offerings.ts` remains the server authority. Product names submitted by the browser are not trusted.

## Required routes

```text
/
/products
/products/compact-transfer-pump
/products/chemical-dosing-skid
/products/mobile-filtration-unit
/about
/request-quote
/contact
/privacy
/terms
```

Each product page must explain intended use, qualification questions and a quote CTA carrying the canonical offering ID. No shopping cart, price calculator, downloadable PDF or product comparison engine is required.

## Navigation and content

- Navigation: Home, Products, About, Request Quote, Contact.
- Homepage: buyer problem, three products, qualification process and quote CTA.
- Products index: one concise card per product with links to its detail page.
- About: supplier capabilities, response process and scope boundaries without invented certifications.
- Request Quote: general inquiry and offering-specific inquiry remain available.
- Legal pages: replace template company identity and contact details with the fictional facts above.

## Visual direction

- Industrial but lightweight, not a copy of Tucsenberg.
- Dark slate, off-white and teal accent.
- Use CSS, design tokens and simple SVG/shape treatment; do not add a design framework or image generator dependency.
- Maintain responsive behavior, keyboard access and readable contrast.

## Allowed changes

- Business pages under `src/app/[locale]/**`.
- Presentational components under `src/components/**`.
- Offerings, site identity, navigation, page, SEO and public URL configuration.
- `content/**`, `messages/**`, `public/**`, styles and scenario-facing tests.
- Public Worker/R2 example names and `.invalid` URL values in `wrangler.jsonc`.

## Forbidden changes

- `src/app/api/inquiry/**`.
- `src/lib/lead-pipeline/**`.
- Security, Turnstile, rate limiting, Airtable, Resend and logging behavior.
- OpenNext/Cloudflare build scripts and release runner logic.
- Dynamic catalog schema, profile, generator, compatibility aliases or product inquiry kind fields.

If the scenario cannot be completed without a forbidden change, stop and report `TEMPLATE_STRUCTURAL_FAILURE`.

## Required verification

Run the repository's complete static, test, Playwright, Next, OpenNext and Wrangler dry-run lanes. Run strict public-launch verification separately and expect a non-zero result caused by the fictional domain and unconfigured production owner/provider evidence.
