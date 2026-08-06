import type { ProductMarketSlug } from "@/config/single-site-product-catalog";

export interface TucsenbergProductCta {
  label: string;
  /** Quote-SLA promise rendered as a muted line under the button, never inside it (mobile overflow). */
  note?: string;
}

export interface TucsenbergProductTable {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

/**
 * Narrative section: prose paragraphs and/or a bullet list, with an optional
 * closing footer. The absence of a `table` field is what makes this a prose
 * section — content presence is the only signal, there is no separate label.
 */
export interface TucsenbergProductProseSection {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  /** Closing line rendered after bullets; supports inline markdown links. */
  footer?: string;
}

/**
 * Table section: a required data/argument table with optional framing
 * paragraphs and an optional closing footer. The required `table` field is the
 * discriminant that separates this variant from a prose section and makes
 * illegal combinations (e.g. a table with bullets) unrepresentable.
 */
export interface TucsenbergProductTableSection {
  title: string;
  table: TucsenbergProductTable;
  paragraphs?: readonly string[];
  /** Closing line rendered after the table; supports inline markdown links. */
  footer?: string;
}

export type TucsenbergProductSection =
  TucsenbergProductProseSection | TucsenbergProductTableSection;

export interface TucsenbergProductFaq {
  question: string;
  answer: string;
}

export interface TucsenbergProductMeta {
  title: string;
  description: string;
  updatedAt: string;
}

export type TucsenbergProductImage =
  { status: "real"; src: string } | { status: "pending" | "omitted" };

export type TucsenbergProductDiagramKind =
  "boxwall" | "gate" | "bag" | "tube" | "frp";

export interface BoxwallDiagramLabels {
  waterSide: string;
  loadSealsBase: string;
  profile: string;
  load: string;
  floodSide: string;
  drySide: string;
  heightRange: string;
}

export interface GateDiagramLabels {
  planks: string;
  seal: string;
  post: string;
}

export interface BagDiagramLabels {
  shipsFlat: string;
  addWater: string;
  activatedWeight: string;
  stacking: string;
}

export interface TubeDiagramLabels {
  waterSide: string;
  skirtAndPins: string;
  tubeConstruction: string;
}

export interface FrpDiagramLabels {
  heightClass: string;
  profile: string;
  properties: string;
}

interface TucsenbergProductDiagramBase {
  ariaLabel: string;
  caption: string;
  /** Instrument-panel header label (mono microcopy) above the drawing. */
  panelLabel?: string;
  /** Upgrade the static drawing to the animated canvas cross-section. */
  animated?: boolean;
}

/**
 * Honest technical line drawing shown until owner photos land
 * (copy strategy: 截面图/线图 over stock imagery).
 */
export interface BoxwallProductDiagram extends TucsenbergProductDiagramBase {
  kind: "boxwall";
  labels: BoxwallDiagramLabels;
}

export interface GateProductDiagram extends TucsenbergProductDiagramBase {
  kind: "gate";
  labels: GateDiagramLabels;
}

export interface BagProductDiagram extends TucsenbergProductDiagramBase {
  kind: "bag";
  labels: BagDiagramLabels;
}

export interface TubeProductDiagram extends TucsenbergProductDiagramBase {
  kind: "tube";
  labels: TubeDiagramLabels;
}

export interface FrpProductDiagram extends TucsenbergProductDiagramBase {
  kind: "frp";
  labels: FrpDiagramLabels;
}

export type TucsenbergProductDiagram =
  | BoxwallProductDiagram
  | GateProductDiagram
  | BagProductDiagram
  | TubeProductDiagram
  | FrpProductDiagram;

/**
 * Straight-run unit estimator (quote funnel: quantities only, never prices).
 * `unitWidthCm` must come from a real owner spec — never invented.
 */
export interface TucsenbergProductCalculator {
  heading: string;
  intro: string;
  inputLabel: string;
  unitSelectLabel: string;
  /** Width of one straight unit in cm (real spec basis for the estimate). */
  unitWidthCm: number;
  /** e.g. "straight units" */
  resultUnitLabel: string;
  /** Honest limits: what the estimate does not cover. */
  disclaimer: string;
  ctaLabel: string;
  catalogProductId: ProductMarketSlug;
  /** RFQ prefill message; placeholders: {length}, {units}. */
  rfqMessageTemplate: string;
}

/** One scene tile: real photo when delivered, honest line-drawing base until then. */
export interface TucsenbergProductScene {
  title: string;
  note: string;
  image?: { src: string; alt: string };
}

/** "Can I use it on my site?" wall — answers by showing, not telling. */
export interface TucsenbergProductScenes {
  title: string;
  intro?: string;
  /**
   * Honest-boundary block rendered after the scene grid (Q2's full answer is
   * "fits X, wrong for Y"); supports inline markdown links.
   */
  boundary?: string;
  items: readonly TucsenbergProductScene[];
}

export interface TucsenbergProductPage {
  slug: ProductMarketSlug;
  meta: TucsenbergProductMeta;
  image: TucsenbergProductImage;
  diagram?: TucsenbergProductDiagram;
  eyebrow: string;
  title: string;
  subtitle: string;
  lead: string;
  /** Honest-boundary note rendered after the lead; supports inline markdown links. */
  leadNote?: string;
  cta: TucsenbergProductCta;
  downloadHref: string;
  /** Page-specific request-a-quote guidance shown in the final CTA section. */
  rfqNote?: string;
  /** Scannable proof strip under the hero; verifiable facts only, never invented. */
  proofStrip?: readonly string[];
  scenes?: TucsenbergProductScenes;
  /** Optional straight-run estimator rendered after the content sections. */
  calculator?: TucsenbergProductCalculator;
  sections: readonly TucsenbergProductSection[];
  faqs: readonly TucsenbergProductFaq[];
}
