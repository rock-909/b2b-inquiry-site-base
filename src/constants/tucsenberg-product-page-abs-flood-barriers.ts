import type { TucsenbergProductPage } from "@/constants/tucsenberg-product-page-types";
import { TB_BW_HEIGHT_RANGE } from "@/constants/tucsenberg-product-spec-values";

export const ABS_FLOOD_BARRIERS_PRODUCT_PAGE = {
  slug: "abs-flood-barriers",
  meta: {
    title: "ABS Interlocking Flood Barriers — Freestanding Boxwall",
    description: `Freestanding ABS interlocking flood barriers, factory-direct from China. ${TB_BW_HEIGHT_RANGE.label} heights; straight, curve and gable-end units. Reply within 12 hours.`,
    updatedAt: "2026-07-05T00:00:00Z",
  },
  image: { status: "pending" },
  diagram: {
    kind: "boxwall",
    animated: true,
    panelLabel: "TB-BW BOXWALL · SELF-ANCHORING PRINCIPLE",
    ariaLabel:
      "TB-BW ABS boxwall flood barrier — freestanding L-profile side view with water load sealing the base",
    caption:
      "Principle — the flood's own weight presses the apron down; no fixing to the building. Schematic, not to scale — dimensions confirmed at quotation. Product photography in preparation.",
    labels: {
      waterSide: "water side",
      loadSealsBase: "load seals the base",
      profile: "interlocking ABS unit — freestanding L-profile",
      load: "LOAD",
      floodSide: "FLOOD SIDE",
      drySide: "DRY SIDE",
      heightRange: TB_BW_HEIGHT_RANGE.label,
    },
  },
  eyebrow: "TB-BW series",
  title: "ABS Interlocking Boxwall Flood Barriers",
  subtitle:
    "Freestanding flood barriers for driveways, doorways and paved perimeters — no drilling, no fixing to the building.",
  lead: `A freestanding flood barrier that needs no bolts, no rails, and no preparation on the building. Each ABS unit locks into the next; the approaching water presses the L-shaped base down and seals it against the ground. Heights from ${TB_BW_HEIGHT_RANGE.minimumCm} to ${TB_BW_HEIGHT_RANGE.maximumCm} cm, with straight, curved and gable-end units so the wall actually closes around real sites. We supply dealers, contractors and businesses factory-direct, from a single carton to full containers.`,
  cta: {
    label: "Request a Quote",
    note: "Reply within 12 hours.",
  },
  downloadHref: "/downloads/spec-sheet-tb-bw.pdf",
  proofStrip: [
    "Freestanding — no fixing",
    `${TB_BW_HEIGHT_RANGE.label} heights`,
    "−40 °C to +95 °C",
    "UV-stabilised ABS",
    "3-year warranty",
    "MOQ one carton",
  ],
  scenes: {
    title: "Where it works",
    intro:
      "Freestanding on paved and firm ground — the same configuration family closes very different sites. Site photography is being prepared; schematics hold each position until it lands.",
    boundary:
      "Where it doesn't: on heavily broken or sloped ground — deep grooves, divots, recessed paving lines — boxwall may be the wrong tool. Send site photos with your RFQ and we'll say so, and point you to [tube dams](/products/flood-tube-dams) if that's the honest answer.",
    items: [
      {
        title: "Driveways",
        note: "Walls off a sloped approach with curved units — no rails, no drilling.",
      },
      {
        title: "Doorways & shopfronts",
        note: "A single carton covers a standard opening; gable ends close the run.",
      },
      {
        title: "Paved perimeters",
        note: "Straight, curved and gable-end units follow property lines.",
      },
      {
        title: "Warehouses & loading yards",
        note: "Deploys by hand ahead of forecast flooding; rinses and stacks flat after.",
      },
      {
        title: "Ramp & garage entrances",
        note: "Holds back sheet flow before it reaches the down-ramp.",
      },
      {
        title: "Municipal & emergency stock",
        note: "One SKU, tool-free, deployable on any sound paved surface.",
      },
    ],
  },
  sections: [
    {
      title: "How it works",
      bullets: [
        "Freestanding L-profile. The barrier stands on its own foot. As floodwater rises, its weight pushes the foot down — the water itself makes the seal tighter. No anchors, no drilling, no damage to the surface.",
        "Mechanical interlock. Units connect by hand with a locking-and-coupling joint — no tools, no loose pins.",
        "Corners, curves and gable ends. Inward-curve, outward-curve and gable-end units are available at every height, so the wall follows driveways, entrances and property lines — the same configuration family our factory pool has shipped to US flood brands for years.",
        "Ground sealing. The base seal takes up small surface irregularities; on rough ground a ground sheet under the run improves sealing. The honest limits of what it can seal are stated above, next to the scenes.",
      ],
    },
    {
      title: "Not the disposable kit you saw on Amazon",
      paragraphs: [
        "Cheap ABS flood kits exist. They are thinner, degrade in sunlight, and are sold as disposable. Professional boxwall systems differ in ways you can measure:",
      ],
      table: {
        columns: ["What to check", "Disposable kits", "TB-BW series"],
        rows: [
          ["Wall thickness", "typically unstated", "4–5 mm (±0.5)"],
          ["UV performance", "no / unstated", "UV-stabilised ABS"],
          ["Temperature range", "unstated", "−40 °C to +95 °C working range"],
          [
            "Interlock",
            "loose pins or none",
            "full mechanical locking-and-coupling joint",
          ],
          [
            "Configurations",
            "straight only",
            "straight, inward/outward curve, gable end",
          ],
          ["Spares", "none", "joints, seals and single units sold separately"],
        ],
      },
      footer:
        "Full comparison across every material class: [ABS vs Aluminum vs FRP vs Water-Filled — How to Choose](/guides/flood-barrier-materials-guide).",
    },
    {
      title: "Specifications",
      table: {
        columns: [
          "Height",
          "Model",
          "Straight unit",
          "Curve units (in/out)",
          "Wall thickness",
        ],
        rows: [
          ["50 cm", "TB-BW50", "3.8 kg", "2.8 / 2.7 kg", "4 mm"],
          ["60 cm", "TB-BW60", "7.4 kg", "3.3 / 3.3 kg", "4–5 mm"],
          ["75 cm", "TB-BW75", "9.8 kg", "3.2 / 3.2 kg", "4–5 mm"],
          [
            "85 cm (with handle)",
            "TB-BW85",
            "9.8 kg",
            "5 / 5 kg",
            "5 mm — effective stop height 75 cm",
          ],
        ],
      },
      footer:
        "Spec deep-dive: [Demountable flood barrier specifications explained](/guides/flood-barrier-specifications) — heights, model codes, unit weights and wall thickness in plain engineering language.",
    },
    {
      title: "What determines your price",
      paragraphs: [
        "We don't publish list prices — quantities, height mix and configuration move the number too much for a static price to be honest. What you can expect:",
      ],
      bullets: [
        "Quantity ladder. Carton < pallet < container: unit cost drops at each step, freight per unit drops faster.",
        "Height mix. An 85 cm unit uses far more material than a 50 cm unit; mixed orders are normal.",
        "Configuration mix. Corners and gable ends cost more than straights — but they're what makes a wall actually close.",
        "Branding. Moulded-in logo has a mould cost; printed labels and custom packaging are cheap at pallet volume.",
      ],
      footer:
        "Use the Request a Quote button on this page. We reply within 12 hours. If the details are sufficient, the reply includes a quote. Otherwise, we ask only for the missing essentials.",
    },
    {
      title: "Small orders, samples, first-time buyers",
      bullets: [
        "Minimum order: one carton / small pallet lot. We don't ship single retail units — international freight on one unit costs more than the unit.",
        "Paid sample kit: 2 straight units + 1 corner + documentation, at sample price plus freight. The sample fee is credited against your first order.",
        "First time importing from China? We'll walk you through terms, documents and freight in plain language — ask anything in the RFQ form.",
      ],
    },
    {
      title: "OEM & private label",
      paragraphs: [
        "Boxwall is the easiest line in our range to brand as your own:",
      ],
      bullets: [
        "Moulded-in logo on the unit face (mould contribution applies, quoted per project)",
        "Printed labels, custom carton and pallet presentation",
        "Your manual / datasheet layout with your branding",
        "Custom colours from moulded-batch quantities — confirmed at quotation",
      ],
      footer:
        "See [OEM & Wholesale](/oem-wholesale) for how our factory pool handles private label across every product line.",
    },
  ],
  faqs: [
    {
      question: "Can one person deploy it?",
      answer:
        "Yes — units connect by hand at ground level. For long runs two people are faster: one places, one locks.",
    },
    {
      question: "How does it seal on uneven ground?",
      answer:
        "The base seal handles small irregularities, and rising water presses the foot down harder. For gravel, deep joints or slopes, use a ground sheet — or send photos with your RFQ and we'll advise, including when boxwall is the wrong tool.",
    },
    {
      question: "Will water seep through?",
      answer:
        "Some — and any supplier who says otherwise is overselling. Every freestanding barrier lets a small amount of water past joints and the base seal; the wall keeps the flood out, a pump keeps the protected side dry. Plan barrier plus pump as one system, and rain falling behind the wall needs the same pump anyway.",
    },
    {
      question: "What kinds of floodwater does it handle?",
      answer:
        "Rising or standing water is the design case — the load presses the foot down and the wall gets tighter. Salt water doesn't harm the ABS shell (rinse after use), but storm surge and fast-moving water add wave and impact loads no freestanding wall should be asked to hold alone. Tell us your water type in the RFQ and we'll say honestly which case you're in.",
    },
    {
      question: "How many times can it be reused?",
      answer:
        "The units are solid ABS with mechanical locks — designed for repeated seasonal deployment. Rinse, dry, stack. Spare joints and seals are available separately, so one damaged part never retires a wall.",
    },
    {
      question: "Can this replace sandbags?",
      answer:
        "For repeated seasonal use on paved ground, yes — no filling, no disposal, and one person can wall off a driveway. But we won't oversell it: sandbags still win for salt water, odd gaps, moving water and lowest possible cost. If your flooding is storm surge, read the honest limits above before you spend money.",
    },
    {
      question: "What's the warranty?",
      answer:
        "3 years on materials and workmanship — a year longer than the 2-year norm most suppliers offer. Custom-cut and custom-branded items are final sale. Full terms: [Warranty policy](/warranty).",
    },
    {
      question: "What's the lead time?",
      answer:
        "In-stock configurations ship in 2–7 days. Production orders (custom colours, moulded logos) are confirmed at quotation.",
    },
  ],
  calculator: {
    heading: "How many units do I need?",
    intro:
      "Enter the length you want to protect and we'll estimate the number of straight units, based on the 100 cm footprint width of one TB-BW straight unit.",
    inputLabel: "Length to protect",
    unitSelectLabel: "Unit of length",
    unitWidthCm: 100,
    resultUnitLabel: "straight units",
    disclaimer:
      "Straight-run estimate, quantities only — no prices here by design. Corners, gable ends, joint overlap, uneven ground and how the run terminates all change the final count, and a barrier holds water back — it doesn't drain it. Send this estimate with your site details and we'll confirm the exact configuration at quotation.",
    ctaLabel: "Get a quote for this configuration",
    catalogProductId: "abs-flood-barriers",
    rfqMessageTemplate:
      "TB-BW ABS boxwall: protect approx. {length}, estimated {units} straight units (100 cm unit footprint basis). Please confirm corners, gable ends and exact configuration.",
  },
  rfqNote:
    "Tell us the opening or perimeter you're protecting, the ground surface (photos help), the height you need, and roughly how many metres. We reply within 12 hours. If the details are sufficient, the reply includes a quote. Otherwise, we ask only for the missing essentials. In-stock configurations ship in 2–7 days.",
} as const satisfies TucsenbergProductPage;
