---
paths:
  - "src/app/api/**/*"
  - "src/lib/security/**/*"
  - "src/lib/api/**"
  - "src/lib/lead-pipeline/lead-schema.ts"
  - "src/components/forms/**"
  - "src/config/security.ts"
  - "next.config.ts"
---

# Security Rules

Use this file when changing API routes, public write endpoints, Server Actions,
validation, rate limits, CSP, sensitive server code, or env exposure.

## Public write endpoints

Browser-exposed write endpoints need:

- body size gate;
- Zod validation;
- Turnstile or equivalent browser anti-abuse check;
- small route-local or shared rate limit when currently wired;
- stable machine-readable error codes.

The existing distributed rate limiter is wired to public write routes; do not
replace it or add body hashing, replay detection, fingerprinting, or similar
abuse-control layers without a real incident.

## Turnstile failure classification

Keep Turnstile failure handling centralized. Do not create route-local
classification logic unless the route has a documented business reason.

- Missing browser token means verification is required.
- Invalid token, action, or hostname means anti-abuse failure.
- Missing server configuration, network failure, or timeout means service
  unavailable.
- Public write routes must expose stable machine-readable error codes for these
  categories.

## Lead-family behavior

Canonical behavior for contact and inquiry:

```text
browser form -> route handler -> Zod -> Turnstile -> process lead -> owner email, then Airtable record
```

- Owner email is sent first; the Airtable record is created afterwards with the
  email outcome baked into its free-text `Message` field. Sequential, not
  parallel: the record and the fact that its
  notification failed have to be born together, or a saved lead sits in the CRM
  looking identical to one the owner was actually told about.
- Either channel succeeding is still the user-facing success condition
  (email-best-effort policy: a lead must never be rejected while at least one
  delivery channel works).
- When Airtable fails but email succeeds, the route returns success and the
  failure is logged as an error for manual CRM backfill.
- Both channels failing returns failure with a stable error code.
- User-facing `partialSuccess` is not part of the target contract.

Buyer-controlled free-text fields sent to Airtable or another spreadsheet-like
sink must use `sanitizeAirtableTextField()` before record creation. Airtable's
typed Email field is the narrow exception: the lead schema rejects
formula-capable prefixes, and the valid address is stored unchanged so ordinary
plus-addressing keeps working.

When changing contact, inquiry, or Airtable field mapping behavior,
update focused lead-family tests for the changed contract. Do not rely on email
happy-path proof to prove CRM persistence.

## Server-only code

- Add `import "server-only"` to sensitive server modules.
- Route handlers and Server Actions must validate and authorize internally.
- Middleware/proxy filtering is optional front-line protection, not the only
  authorization layer.
- Do not pass trusted identity, client IP, or auth decisions through middleware
  headers for public write flows.

## Endpoint notes

| Endpoint | Expected protection |
| --- | --- |
| `/api/inquiry` | Turnstile + validation + body size gate + inquiry rate limit + honeypot while wired |
| `/api/csp-report` | body size gate + rate limit; never trust payload content |
| `/api/health` | public health only; no credentials, config dumps, or env details |

Turnstile verification is internal to the protected write routes. Do not add a
public token preflight endpoint: Turnstile tokens are single-use, so a preflight
would consume the token before the real submission.

### CSP report endpoint

`/api/csp-report` accepts only bounded report payloads in the supported report
shapes, never trusts payload content, and keeps its health probe read-only.

### JSON body parsing contract

Public write routes parse request bodies through `safeParseJson`
(`src/lib/api/safe-parse-json.ts`) instead of hand-rolling body reads, so size,
empty-body, and top-level-array policy stay consistent. Only an endpoint that
actually accepts batches may opt into arrays.

### Inquiry anti-abuse (active public writer)

The shared `InquiryForm` owns a visually hidden, keyboard-inert `website`
honeypot field. Real browsers leave it empty; a filled value returns the same
public `200` success envelope as a real submission, including a normal
product-shaped `PRO-` reference id, and skips Turnstile plus delivery. Honeypot
hits are identified only by the server-side `Inquiry honeypot triggered` log
event (with the same reference id). Do not expose honeypot-specific validation
errors or markers in the public JSON.

## CSP and headers

- Security header behavior lives in `src/config/security.ts` and Next.js
  native `headers()` in `next.config.ts`.
- Middleware owns retired-locale fast-404 plus next-intl routing delegation. It
  does not own CSP, generic security headers, locale-cookie setup, or leaked
  cookie cleanup.
- Do not use `NextResponse.next({ headers })` to push broad response headers
  from middleware/proxy. It can break framework-owned responses such as Server
  Actions and streaming.
- `NEXT_PUBLIC_SECURITY_MODE=strict` means enforced security headers with a
  static-compatible CSP. It is not nonce-level strict CSP.
- CSP stays static-compatible for the current site deployment. Do not add
  dynamic nonce handling unless a dedicated dynamic rendering proof plan
  justifies the trade-off.
- Do not mix nonce-based CSP into ordinary security cleanup; it needs a separate
  dynamic-rendering and Cloudflare/OpenNext proof.
- CSP reports go to `/api/csp-report`.
- Each accepted CSP violation is logged once: routine reports use `logger.warn`;
  suspicious patterns use a single `logger.error`.
- Do not use unfiltered `dangerouslySetInnerHTML`.
- URL values must allow only `https://`, `http://`, or site-relative `/`.

## Env boundaries

- App/runtime code reads server values through `@/lib/env`.
- Browser code reads only `NEXT_PUBLIC_*` helpers exported from `@/lib/env`.
- Do not expose server secrets through `NEXT_PUBLIC_*`.
- Sensitive keys include `AIRTABLE_API_KEY`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`, Cloudflare API tokens, and owner dashboard access
  keys.
