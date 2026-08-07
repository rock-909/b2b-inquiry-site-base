# Hybrid offering clean-room brief

## Fixed source

- Candidate tag: `candidate-2026-08-06.1`
- Candidate commit: `8e241ea346fbc80fd53347b9a0dc193310ccafca`
- Scenario verdict must be based on a detached worktree created from that commit.

## Company facts

- Public name: `ModuCore Industrial Systems`
- Legal name: `ModuCore Industrial Systems LLC`
- Domain: `https://moducore.example.invalid`
- Email: `projects@moducore.example.invalid`
- Phone: `+1 555 014 3400`
- Location: `Fort Wayne, Indiana, United States`
- Positioning: standard industrial control packages with a separate path for custom panel and monitoring projects.
- Primary CTA: `Start a project discussion`

The company, domain and contact details are fictional. The `.invalid` domain and missing production providers must keep strict public-launch verification red.

## Standard offerings

| ID | Name | Buyer need |
| --- | --- | --- |
| `standard-control-panel` | Standard Control Panel | Start from a documented control-panel package for a bounded machine or process requirement. |
| `modular-monitoring-kit` | Modular Monitoring Kit | Add a standard monitoring package for selected operating signals and alarms. |

Custom projects do not receive a fake offering ID. Buyers use free-text `interest` and `message` to describe custom scope.

## Required routes

```text
/
/solutions
/solutions/standard-control-panel
/solutions/modular-monitoring-kit
/custom-project
/about
/request-quote
/contact
/privacy
/terms
```

The two standard solution pages carry canonical offering IDs. `/custom-project` explains the information needed for a custom discussion and links to the existing general inquiry form without inventing an offering.

## Navigation and content

- Navigation: Home, Solutions, Custom Project, About, Request Quote, Contact.
- Homepage: standard starting points, custom-project boundary, working process and inquiry CTA.
- Solutions index: two standard packages and a clear route to custom work.
- Custom Project: application, interfaces, environment, timing and documentation inputs expressed as content guidance, not new form fields.
- About: engineering handoff and scope-control approach without invented certifications.
- Legal pages: replace template company identity and contact details with the fictional facts above.

## Visual direction

- Modular systems identity distinct from the other two scenarios.
- Graphite, pale gray and lime accent.
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
- Dynamic form builder, custom-project schema, provider abstraction, runtime mode or compatibility alias.

If the scenario cannot be completed without a forbidden change, stop and report `TEMPLATE_STRUCTURAL_FAILURE`.

## Required verification

Run the repository's complete static, test, Playwright, Next, OpenNext and Wrangler dry-run lanes. Run strict public-launch verification separately and expect a non-zero result caused by the fictional domain and unconfigured production owner/provider evidence.
