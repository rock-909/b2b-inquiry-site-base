# B2B Catalog Clean-Room Design

**Date:** 2026-08-12
**Status:** Approved design
**Product contract:** Built-in product catalog with static product detail routes

## Goal

Finish the independent B2B inquiry template as a clean, neutral catalog site:

- ship a small built-in product catalog;
- keep one canonical product source for pages, SEO, structured data, sitemap,
  email, and optional Airtable storage;
- remove donor identity, donor business assumptions, migration residue, and the
  Airtable SDK;
- preserve the existing inquiry, security, Cloudflare, and release-proof
  boundaries;
- produce explicit evidence for local release readiness without presenting it
  as proof of a real production launch.

## Non-goals

- No CMS, database-backed catalog, runtime catalog mode, or profile selector.
- No prices, inventory, ratings, MOQ, certifications, lead-time promises, or
  downloads without owner-confirmed facts.
- No product variants, categories, filters, comparison tools, or search.
- No forced rewrite or force-push of the current repository history.
- No creation, deletion, or mutation of real Cloudflare resources without
  separate authorization and credentials.

## Catalog architecture

### Canonical product source

`src/config/offerings.ts` remains the only product authoring source. The
catalog uses a static `OFFERINGS` array with this minimum contract:

```ts
export interface Offering {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly highlights: readonly string[];
}
```

`id` is also the public URL slug. There is no second `slug` field, so routing,
inquiry validation, email, and storage cannot drift onto separate identities.

The template ships one clearly non-production reference entry named
`sample-offering`. Strict client-launch content checks continue to block a real
launch until a derived-site owner replaces the sample with verified products.

### Routes

The catalog adds two English public routes:

- `/products` lists configured offerings;
- `/products/[slug]` renders one offering.

The route files live at:

- `src/app/[locale]/products/page.tsx`
- `src/app/[locale]/products/[slug]/page.tsx`

The detail route uses `generateStaticParams()` from `OFFERINGS`. It calls
`notFound()` for an unknown slug and never falls back to another product.

The static page registry gains the `/products` index. Dynamic detail URLs are
derived directly from `OFFERINGS` for sitemap generation rather than being
pretended to be static `PageType` entries.

### Navigation and buyer flow

Products becomes a configured navigation and footer entry. Product cards link
to their detail route. The detail-page primary action links to:

```text
/request-quote?offeringId=<offering.id>
```

The request-quote page continues to resolve the query through the server-owned
offering registry. General inquiry remains valid without an `offeringId`.

## Content and identity boundaries

Each buyer-visible value has one owner:

| Value | Canonical source |
| --- | --- |
| Site and company identity | `src/config/single-site.ts` |
| Public base URL | site config plus approved runtime environment override |
| Contact email | site config |
| Social links | site config |
| Product facts and reviewed product copy | `src/config/offerings.ts` |
| Shared product/navigation labels | message packs |
| Email labels and subject copy | `src/emails/email-copy.ts` |
| Sitemap URLs | page registry plus `OFFERINGS` |
| Product metadata and JSON-LD | the resolved offering plus site config |
| Open Graph identity | site config and resolved page/product metadata |

Hardcoded duplicate reference identity is removed from runtime environment
defaults and MDX body copy when the same value already belongs to site config.
Reference content may explain that the template is non-production, but it must
not create a second site name, email, URL, or product identity source.

## SEO and structured data

The products index receives normal page metadata from the shared metadata
pipeline. Each detail page builds title, description, canonical URL, and Open
Graph metadata from its resolved offering and `SITE_CONFIG.baseUrl`.

Product detail pages reuse the existing `generateProductData()` and breadcrumb
generators. Product JSON-LD contains only supported facts:

- name;
- description;
- canonical URL;
- configured brand/site identity;
- image only when the offering has a real maintained image in a future change.

The template does not emit `Offer`, price, availability, aggregate rating,
review, SKU, certification, or delivery claims.

## Inquiry contract

The existing inquiry boundary stays intact:

1. The browser sends an optional offering ID, buyer fields, attribution fields,
   and a Turnstile token.
2. The API validates the scalar payload and checks the offering ID against the
   canonical registry.
3. The server resolves the offering name; the browser cannot supply a trusted
   product name.
4. Resend and optional Airtable storage receive the same normalized offering
   identity.
5. General inquiries omit offering identity.

An unknown API `offeringId` is rejected. An unknown product detail slug returns
404. Retired donor payload aliases such as `legacyProductId` are removed from
the current contract and its fixtures instead of being kept as migration
history.

## Airtable without the SDK

The `airtable` package and SDK adapter files are removed. The service uses the
platform `fetch` implementation to call the Airtable records API:

```text
POST https://api.airtable.com/v0/<base-id>/<encoded-table-name>
Authorization: Bearer <api-key>
Content-Type: application/json
```

The request body remains `{ records: [{ fields }] }`. Existing field builders
and spreadsheet-formula protection remain responsible for output fields.

The HTTP request uses `AbortSignal.timeout(8000)`. The response is successful
only when it is a 2xx response containing a non-empty first record ID. Errors
retain stable application-facing messages and log only sanitized context; API
keys, response bodies, and raw buyer email are never logged.

Storage remains optional. Missing Airtable configuration makes the storage
channel unavailable but does not disable email delivery.

## Delivery failure semantics

The existing email-first, optional-storage policy remains:

1. Try owner email with its existing hard timeout.
2. Write the optional Airtable record and include the owner warning in the
   free-text message when email failed.
3. Return success when either channel succeeds.
4. Return `PROCESSING_FAILED` only when both channels fail.

Turnstile validation, distributed production rate limiting, input validation,
marketing-consent filtering, PII redaction, and reference ID generation are not
simplified or removed.

## Donor and fixture neutralization

Current tracked source must contain no donor identity or flood-barrier business
facts. Product fixtures use the agreed neutral vocabulary:

- `sample-offering` for the configured reference product;
- `unknown-product` for rejected product identity;
- `unsupported-locale` for invalid locale examples;
- `example.invalid` for non-routable public URLs;
- `buyer@example.com` for buyer email fixtures.

`custom-fabrication`, donor product models, `/zh` migration fixtures, retired
locale narration, and donor incident comments are removed. Generic tests for
MOQ, certification, or lead-time parsing may remain only when they test a
content primitive rather than claim template business facts; their examples
must be neutral and clearly test-owned.

## Cloudflare and repository boundaries

The following runtime and proof surfaces stay:

- `src/proxy.ts` as the thin next-intl proxy entry;
- the pinned OpenNext package and local Node proxy bundling patch;
- separate Preview and Production R2 incremental-cache bindings;
- Cloudflare build, artifact checks, Wrangler dry-run, and release verification;
- deployed smoke and real delivery proof as separate manual gates.

Worker, bucket, and domain values remain obvious template sentinels until a
derived-site owner provides real values. The production gate must reject those
sentinels. The repository must not pretend that absent GitHub secrets or
Cloudflare credentials represent a deployable production connection.

GitHub state is reported separately from source state. Existing new-repository
PRs and caches are not donor inheritance, but old-resource absence is claimed
only where the GitHub API provides evidence. Branch protection or ruleset state
that the current private-repository plan cannot expose remains `unverified`.

## Clean-root artifact

After implementation and verification, create a separate clean-root candidate
from tracked source only. The candidate must exclude Git metadata, ignored build
outputs, dependency directories, reports, logs, local environment files, and
credentials.

This artifact is produced separately from the working repository. Replacing
`main`, rewriting history, deleting tags, or force-pushing requires explicit
authorization and is not implied by producing the candidate.

## OpenNext maintenance baseline

The existing OpenNext maintenance document remains authoritative and must state:

- why Next.js 16.3 Node proxy output requires the local bundling patch;
- the upstream release conditions required before removing it;
- the serial Next build, OpenNext build, handler, R2, artifact, dry-run, Preview,
  and deployed-smoke checks required for upgrades;
- rollback to the last jointly verified OpenNext pin, patch, lockfile, and proxy;
- a 3,000 KiB gzip hard budget and 2,700 KiB preferred warning threshold.

Removing the patch is an atomic migration, not an opportunistic cleanup.

## Acceptance criteria

### Catalog behavior

- Given the reference catalog, when `/products` loads, then it lists
  `sample-offering` and links to its detail route.
- Given `sample-offering`, when its detail route loads, then page copy,
  metadata, JSON-LD, sitemap identity, and RFQ link all resolve from the same
  offering object.
- Given `unknown-product`, when its detail route loads, then it returns 404.
- Given an unknown inquiry offering ID, when the API validates it, then the
  request is rejected before delivery.

### Delivery behavior

- Given valid inquiry data and working email, when optional Airtable is absent
  or fails, then the inquiry succeeds and reports `emailSent: true`.
- Given failed email and working Airtable, when the record is created, then the
  inquiry succeeds and the stored message tells the owner email failed.
- Given both channels fail, when processing completes, then it returns
  `PROCESSING_FAILED` without leaking PII.

### Clean-room proof

- Current tracked source contains no donor identity or donor business facts.
- Tracked image/PDF assets contain no donor metadata.
- No real secret or local environment file is tracked.
- Focused inquiry, catalog, routing, structured-data, Airtable, and failure-mode
  tests pass.
- Type checks, lint, complete Vitest, content checks, Knip, and React Doctor pass.
- `pnpm build`, client-boundary proof, `pnpm website:build:cf`, OpenNext handler
  proof, Wrangler preview dry-run, and `pnpm release:verify` pass in their required
  serial order.
- Real deployment, deployed inquiry, persisted Airtable record, and owner email
  receipt are reported as complete only when independently observed; otherwise
  they remain explicitly not completed or `unverified`.

## Implementation order

1. Commit the already prepared `/zh` and migration-history cleanup after its
   focused tests remain green.
2. Add the static product model, routes, navigation, SEO, JSON-LD, sitemap, and
   inquiry handoff with behavior-first tests.
3. Replace donor/product fixtures and consolidate identity sources.
4. Replace the Airtable SDK with native `fetch`, preserving delivery semantics.
5. Re-run neutralization, secret, asset, Cloudflare, and GitHub-state audits.
6. Run the complete serial release proof.
7. Produce and inspect the separate clean-root candidate.
