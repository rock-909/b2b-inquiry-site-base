import type { Page } from "@/types/content.types";

const privacyPage = {
  slug: "privacy",
  metadata: {
    title: "Privacy policy — to be completed",
    description: "Incomplete placeholder. The site operator must replace this before launch.",
    slug: "privacy",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    draft: false,
    seo: {
      title: "Privacy policy — to be completed",
      description: "Incomplete placeholder. The site operator must replace this before launch.",
    },
  },
  content: String.raw`
This privacy policy is incomplete. Before launch, the site operator must document who controls the data, what is collected, its purpose, service providers, retention, cookies (including optional analytics and advertising cookies, which are only used with the visitor’s consent) and how people can exercise their rights.

Replace this placeholder with a policy reviewed for the actual business and applicable law.
`,
} satisfies Page;

export default privacyPage;
