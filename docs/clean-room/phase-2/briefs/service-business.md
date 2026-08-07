# Service business clean-room brief

## Fixed source

- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario verdict must be based on a detached worktree created from that commit.

## Company facts

- Public name: `FieldAxis Reliability Services`
- Legal name: `FieldAxis Reliability Services LLC`
- Domain: `https://fieldaxis.example.invalid`
- Email: `projects@fieldaxis.example.invalid`
- Phone: `+1 555 014 2300`
- Location: `Milwaukee, Wisconsin, United States`
- Service area: industrial facilities in the Great Lakes region.
- Positioning: field reliability support for maintenance teams that need a scoped inspection, maintenance visit or fault investigation.
- Primary CTA: `Discuss a site requirement`

The company, domain and contact details are fictional. The `.invalid` domain and missing production providers must keep strict public-launch verification red.

## Offerings

| ID | Name | Buyer need |
| --- | --- | --- |
| `site-inspection` | Site Inspection | Document equipment condition, operating context and immediate follow-up priorities. |
| `preventive-maintenance` | Preventive Maintenance Visit | Complete a scoped maintenance visit around an agreed asset list and service window. |
| `fault-diagnostics` | Fault Diagnostics | Investigate recurring symptoms and define the next practical diagnostic or repair action. |

The offerings are services, not products. Do not add product inventory, product specifications, catalog metadata or a service-mode switch.

## Required routes

```text
/
/services
/services/site-inspection
/services/preventive-maintenance
/services/fault-diagnostics
/about
/request-quote
/contact
/privacy
/terms
```

Each service page must explain suitable situations, buyer inputs, working process and an inquiry CTA carrying the canonical offering ID.

## Navigation and content

- Navigation: Home, Services, About, Request Quote, Contact.
- Homepage: operating problem, service categories, engagement process, service area and inquiry CTA.
- Services index: one concise card per service with links to detail pages.
- About: field-service working method and response boundaries without invented accreditations.
- Request Quote: ask for facility location, asset context and desired timing through existing `interest` and `message` fields; do not add a dynamic form.
- Legal pages: replace template company identity and contact details with the fictional facts above.

## Visual direction

- Practical field-service identity, not product-catalog styling.
- Navy, warm gray and safety-orange accent.
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
- Product catalog model, runtime service mode, dynamic form schema or provider abstraction.

If the scenario cannot be completed without a forbidden change, stop and report `TEMPLATE_STRUCTURAL_FAILURE`.

## Required verification

Run the repository's complete static, test, Playwright, Next, OpenNext and Wrangler dry-run lanes. Run strict public-launch verification separately and expect a non-zero result caused by the fictional domain and unconfigured production owner/provider evidence.
