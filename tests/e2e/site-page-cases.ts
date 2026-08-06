/**
 * Every canonical public route the smoke run visits, with the H1 it must show.
 *
 * Kept out of the spec file so a Vitest contract test can read it without
 * pulling in `@playwright/test`. The list is written by hand on purpose: the
 * headings are the actual proof, and deriving the paths from the page registry
 * would turn "every page renders" into a statement about itself. What is
 * derived instead is the *comparison* —
 * `tests/unit/routes/site-smoke-route-contract.test.ts` fails when the registry
 * ships a route this list does not cover.
 */
export const SITE_PAGE_CASES = [
  ["/", /Factory-Direct Flood Barriers from China/i],
  ["/products", /Flood Barrier Product Lines/i],
  ["/products/abs-flood-barriers", /ABS Interlocking Boxwall Flood Barriers/i],
  [
    "/products/aluminum-flood-gates",
    /Aluminum Flood Gates & Demountable Barrier Systems/i,
  ],
  ["/products/absorbent-flood-bags", /Absorbent Flood Bags/i],
  ["/products/flood-tube-dams", /Water & Air-Filled Flood Tube Dams/i],
  ["/products/frp-flood-barriers", /FRP Composite Flood Barrier Planks/i],
  ["/oem-wholesale", /OEM, Private Label & Wholesale Supply/i],
  [
    "/guides/flood-barrier-materials-guide",
    /ABS vs Aluminum vs FRP vs Water-Filled Flood Barriers/i,
  ],
  ["/guides/flood-barrier-specifications", /Flood Barrier Specifications/i],
  ["/about", /Who you're actually buying from/i],
  ["/request-quote", /Get real numbers/i],
  ["/contact", /Contact/i],
  ["/warranty", /Warranty Policy/i],
  ["/privacy", /Privacy Policy/i],
  ["/terms", /Terms of Service/i],
] as const satisfies readonly (readonly [string, RegExp])[];
