import type { Page } from "@/types/content.types";

const termsPage = {
  slug: "terms",
  filePath: "/src/content/pages/en/terms.ts",
  metadata: {
    title: "Website Terms Reference",
    description:
      "Non-production reference text for the website-use and inquiry-stage boundaries of a B2B site.",
    slug: "terms",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "legal",
    showToc: true,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Website Terms Reference",
      description:
        "Non-production reference text that must be reviewed and replaced for the operating business and offer.",
    },
  },
  content: String.raw`
> Reference only. This is not legal advice or a production terms document. Replace it with terms reviewed for the real business, offer and jurisdiction.

## Site operator

Identify the legal entity responsible for the website and provide a working contact method.

## Website information

Explain whether pages, downloads and examples are general information, specifications, quotations or contractual commitments. Do not imply guarantees the business has not approved.

## Inquiries and quotations

State that an inquiry does not create an order. Define which written document confirms price, scope, timing, delivery, payment and any custom requirements.

## Buyer and supplier responsibilities

Describe the real boundary for selection, installation, compliance, operation, maintenance and local approvals where those issues apply.

## Updates

State how updated website terms take effect and which signed commercial documents take priority for an actual transaction.
`,
} satisfies Page;

export default termsPage;
