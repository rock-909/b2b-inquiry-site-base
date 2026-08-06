/**
 * Product spec values that more than one buyer-facing surface must state
 * identically. Only facts that are provably duplicated belong here — page
 * prose, tables and per-product copy stay in their own product page files.
 */

/** TB-BW boxwall protection height, shown on the page, in SEO metadata, and on the diagram. */
export const TB_BW_HEIGHT_RANGE = {
  minimumCm: 50,
  maximumCm: 85,
  label: "50–85 cm",
} as const;
