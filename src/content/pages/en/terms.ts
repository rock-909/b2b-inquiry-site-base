import type { Page } from "@/types/content.types";

const termsPage = {
  slug: "terms",
  filePath: "/src/content/pages/en/terms.ts",
  metadata: {
    title: "Terms — to be completed",
    description: "Incomplete placeholder. The site operator must replace this before launch.",
    slug: "terms",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    draft: false,
    seo: {
      title: "Terms — to be completed",
      description: "Incomplete placeholder. The site operator must replace this before launch.",
    },
  },
  content: String.raw`
These terms are incomplete. Before launch, the site operator must document its identity, website use, inquiry handling, applicable terms and a working contact method.

Replace this placeholder with terms reviewed for the actual business and applicable law.
`,
} satisfies Page;

export default termsPage;
