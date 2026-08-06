import type { TucsenbergProductPage } from "@/constants/tucsenberg-product-page-types";

export const FRP_FLOOD_BARRIERS_PRODUCT_PAGE = {
  slug: "frp-flood-barriers",
  meta: {
    title: "FRP Composite Flood Barrier Planks — Corrosion-Free",
    description:
      "Pultruded FRP composite flood planks: corrosion-free, non-conductive, built for coastal and industrial sites. Order-driven production — register interest.",
    updatedAt: "2026-07-06T00:00:00Z",
  },
  image: { status: "pending" },
  diagram: {
    kind: "frp",
    ariaLabel:
      "TB-CP FRP composite flood plank — multi-cell pultruded profile cross-section",
    caption:
      "Profile cross-section: multi-cell pultruded FRP in the 180 mm plank class. Indicative geometry — final profile is confirmed with tooling. Product photography follows first production run.",
    labels: {
      heightClass: "180 mm class",
      profile: "pultruded FRP plank — multi-cell cross-section",
      properties: "corrosion-free · non-conductive · continuous glass fibre",
    },
  },
  eyebrow: "TB-CP series",
  title: "FRP Composite Flood Barrier Planks",
  subtitle:
    "A flood plank that never corrodes, conducts nothing, and shrugs off salt air.",
  lead: "Pultruded fiberglass (FRP), in the same stacked-plank logic as aluminum gates. This is our newest line, produced order-driven with our pultrusion partners. This page tells you honestly what's ready, what's in testing, and what it takes to open a profile — because nobody else in this category writes that down.",
  cta: {
    label: "Register interest",
    note: "We'll share span/deflection test data as it completes.",
  },
  downloadHref: "/downloads/product-catalog.pdf",
  proofStrip: [
    "Pultruded fiberglass",
    "180 mm plank class",
    "Never corrodes",
    "Non-conductive",
    "EPDM sealing",
    "Order-driven production",
  ],
  scenes: {
    title: "Where FRP earns its premium",
    intro:
      "Three environments punish aluminum over a service life — that's the honest scope of this line.",
    boundary:
      "Where it doesn't: if your openings don't live in one of these environments, [aluminum](/products/aluminum-flood-gates) remains the value answer — and we'll tell you so in the quote. One doorway won't clear FRP tooling math either; that honesty is the filter this line runs on.",
    items: [
      {
        title: "Coastal & salt-air sites",
        note: "Corrosion is aluminum's one real weakness over decades; FRP doesn't participate.",
      },
      {
        title: "Chemical & industrial plants",
        note: "Process exposure that eats metal service life.",
      },
      {
        title: "Wastewater sites",
        note: "Continuous chemical and moisture exposure.",
      },
      {
        title: "Substations & switchyards",
        note: "A non-conductive barrier isn't a preference here — it's a spec.",
      },
      {
        title: "De-icing salt zones",
        note: "Roadside and ramp openings with seasonal salt loading.",
      },
      {
        title: "Utility & dealer fleets",
        note: "Volume cases where tooling math works — early buyers shape the range.",
      },
    ],
  },
  sections: [
    {
      title: "Why FRP, and why now",
      paragraphs: [
        "Aluminum demountable systems are the trade standard — and inland, they should be. But three environments punish aluminum over a service life:",
      ],
      bullets: [
        "Coastal and salt-air sites — corrosion is aluminum's one real weakness over decades; FRP simply doesn't participate.",
        "Chemical and industrial exposure — process plants, wastewater sites, de-icing salt zones.",
        "Electrical infrastructure — substations and switchyards, where a non-conductive barrier isn't a preference, it's a spec.",
      ],
      footer:
        "If your openings live in one of those, FRP earns its premium across the service life — the honest scope stated next to the scenes above.",
    },
    {
      title: "Same logic as aluminum, different material",
      bullets: [
        "180 mm plank profile class — designed to the same stacked-plank, post-and-seal system as our aluminum gates, so posts, seals and deployment practice carry over.",
        "Pultruded fiberglass — continuous glass fibre in a resin matrix, the process behind FRP ladders, grating and utility poles: proven material science, newly applied to flood planks built to international specifications.",
        "EPDM sealing — unchanged; sealing is a geometry problem, not a material one.",
      ],
    },
    {
      title: "How order-driven production works (the part nobody publishes)",
      paragraphs: [
        "FRP profiles are made on pultrusion dies. Opening a new profile means tooling — and we'd rather show you the economics than hide them:",
      ],
      bullets: [
        "Tooling: a one-time die cost, quoted per profile, amortised across your first production run.",
        "First run: minimum volumes apply (hundreds of metres, not thousands) — an opening schedule for a real project usually clears it.",
        "Testing: span and deflection verification on the produced profile — data you receive with the delivery, and the dataset we're building publicly as this line matures.",
        "Reorders: the die is cut; subsequent runs price like a standard product.",
      ],
      footer:
        "Transparency is the filter here: if your requirement is one doorway, FRP tooling math won't work and we'll say so — [aluminum](/products/aluminum-flood-gates) will. If it's a coastal project, a utility fleet or a dealer range, the numbers get interesting.",
    },
    {
      title: "Span & deflection data",
      paragraphs: [
        "Testing data for the first profiles is being compiled with our pultrusion partners. Register interest below and we'll send span/deflection tables as they complete — no marketing sheet, the actual numbers.",
      ],
      footer:
        "Where FRP sits among the material classes: [ABS vs Aluminum vs FRP vs Water-Filled — How to Choose](/guides/flood-barrier-materials-guide).",
    },
  ],
  faqs: [
    {
      question: "Is FRP stronger than aluminum?",
      answer:
        "Different, not simply stronger: excellent stiffness-to-weight and zero corrosion, but design data (span limits at height) is profile-specific — which is exactly why we publish test data instead of adjectives.",
    },
    {
      question: "Why doesn't anyone else sell FRP flood planks?",
      answer:
        "Pultrusion and flood barriers live in different industries; crossing them takes tooling risk nobody has taken at full specification. That's the gap this line exists to fill — early buyers shape the profile range.",
    },
    {
      question: "What does it cost?",
      answer:
        "More than aluminum per metre at first run (tooling amortisation), competitive at reorder. Real numbers come with your opening schedule — we reply within 12 hours once the details are clear enough for pricing.",
    },
  ],
  rfqNote:
    'Tell us your site type and rough volumes. You\'ll get: tooling economics for your case, the test dataset as it lands, and first-run scheduling before this page gets an "in stock" badge.',
} as const satisfies TucsenbergProductPage;
