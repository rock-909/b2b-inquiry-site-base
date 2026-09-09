import type { Page } from "@/types/content.types";

const privacyPage = {
  slug: "privacy",
  filePath: "/src/content/pages/en/privacy.ts",
  metadata: {
    title: "Privacy Policy Reference",
    description:
      "Non-production reference text for documenting how a B2B inquiry site handles submitted information.",
    slug: "privacy",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Privacy Policy Reference",
      description:
        "Non-production reference text that must be reviewed and replaced for the operating business and jurisdiction.",
    },
  },
  content: String.raw`
> Reference only. This is not legal advice or a production privacy policy. The operating business must replace and review it for its actual tools, data flows and jurisdictions.

## Site operator

Identify the legal entity operating the website, its contact details and any representative required by the applicable jurisdiction.

## Information collected

Describe the fields submitted through the inquiry form and any technical, security, analytics or campaign data the deployed site actually collects.

## Purpose and sharing

Explain why the business uses inquiry data, which service providers receive it and whether it is used for sales follow-up, quotation, fulfilment or measurement.

## Retention and requests

State the real retention policy and provide a working contact method for access, correction or deletion requests.

## Cookies and analytics

List only the storage and integrations enabled in the deployed environment. Keep consent behaviour consistent with the site's actual configuration.
`,
} satisfies Page;

export default privacyPage;
