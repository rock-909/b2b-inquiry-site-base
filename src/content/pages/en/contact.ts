import type { Page } from "@/types/content.types";

const contactPage = {
  slug: "contact",
  filePath: "/src/content/pages/en/contact.ts",
  metadata: {
    title: "Contact",
    description: "Reference contact content for a B2B inquiry site.",
    slug: "contact",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "default",
    showToc: false,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Contact — B2B Inquiry Site Reference",
      description:
        "Reference contact page showing the minimum information a future business should replace.",
    },
  },
  content: String.raw`
This page is a **non-production reference**. Replace the identity, email, location, response time and operating hours with owner-confirmed details.

The fastest route is the **[inquiry form](/contact)**. A useful request normally includes the requirement, quantity or scope, destination market and timing.
`,
} satisfies Page;

export default contactPage;
