import type { Page } from "@/types/content.types";

const contactPage = {
  slug: "contact",
  metadata: {
    title: "Contact",
    description: "Reference contact content for a B2B inquiry site.",
    slug: "contact",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Contact — B2B Inquiry Site Reference",
      description:
        "Reference contact page showing the minimum information a future business should replace.",
    },
  },
  content: String.raw`
Use the **[inquiry form](/contact#inquiry)** below. This reference site is not ready to receive business inquiries until its owner configures delivery and contact details.
`,
} satisfies Page;

export default contactPage;
