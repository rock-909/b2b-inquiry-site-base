import type { Page } from "@/types/content.types";

const aboutPage = {
  slug: "about",
  filePath: "/src/content/pages/en/about.ts",
  metadata: {
    title: "About This Reference Site",
    description:
      "A neutral reference page for the business identity, operating model and proof a future B2B inquiry site should provide.",
    slug: "about",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "legal",
    showToc: true,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "About This B2B Inquiry Reference Site",
      description:
        "Reference content showing where a future business should explain its identity, operating model and buyer proof.",
    },
  },
  content: String.raw`
This is **reference content for a reusable B2B inquiry site**, not a description of a real company. Replace it with owner-confirmed facts before any production deployment.

## State who the buyer is dealing with

Name the legal entity, trading name, location and role in the supply chain. Keep the website, quotation, invoice and payment beneficiary consistent.

## Explain how the business works

Describe what the company makes, supplies or coordinates. Make the boundary between in-house work, partner work and buyer responsibility easy to verify.

## Show useful proof

Use evidence a buyer can check: approved specifications, samples, inspection options, project records, certifications or written service commitments. Do not publish claims that the owner cannot support.

## Give the next step

The site should end with one clear path: **[start an inquiry](/request-quote)** with the details needed for a useful reply.
`,
} satisfies Page;

export default aboutPage;
