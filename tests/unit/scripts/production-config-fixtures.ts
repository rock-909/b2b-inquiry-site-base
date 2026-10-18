import {
  getPublicContactEmail,
  getPublicContactPhone,
  getPublicLogoPath,
  getPublicFact,
  getPublicFoundingYear,
  getPublicSocialUrl,
} from "@/config/public-trust";

export const STARTER_PUBLIC_LAUNCH_FIXTURE = {
  getPublicContactEmail,
  getPublicContactPhone,
  getPublicLogoPath,
  getPublicFact,
  getPublicFoundingYear,
  getPublicSocialUrl,
  SINGLE_SITE_CONFIG: {
    baseUrl: "https://example.com",
    name: "Showcase Website Starter",
    description:
      "Public demo starter for launching a showcase website foundation",
    seo: {
      titleTemplate: "%s | Showcase Website Starter",
      defaultTitle: "Showcase Website Starter - Public Demo Starter Site",
      defaultDescription:
        "A public demo starter site for teams that need a deployable showcase website foundation before they have a real website.",
    },
    social: {
      twitter: "https://x.com/example",
      linkedin: "https://www.linkedin.com/company/example",
    },
    contact: {
      phone: "+86-518-0000-0000",
      email: "starter-contact@example.com",
    },
  },
  SINGLE_SITE_FACTS: {
    company: {
      name: "Showcase Website Starter",
      location: {
        city: "Replace before launch",
        address: "Replace before launch",
      },
    },
    contact: { phone: "+86-518-0000-0000" },
    brandAssets: { logo: { status: "pending" as const } },
  },
};

export const READY_PUBLIC_LAUNCH_FIXTURE = {
  getPublicContactEmail,
  getPublicContactPhone,
  getPublicLogoPath,
  getPublicFact,
  getPublicFoundingYear,
  getPublicSocialUrl,
  SINGLE_SITE_CONFIG: {
    baseUrl: "https://reference-site.com",
    name: "Reference Industrial",
    description: "Industrial products and buyer support.",
    seo: {
      titleTemplate: "%s | Reference Industrial",
      defaultTitle: "Reference Industrial",
      defaultDescription: "Industrial products and buyer support.",
    },
    social: { twitter: "", linkedin: "" },
    contact: {
      phone: "+86-138-0013-8000",
      email: "sales@reference-site.com",
    },
  },
  SINGLE_SITE_FACTS: {
    company: {
      name: "Reference Industrial LLC",
      location: { city: "New York", address: "1 Industrial Way" },
    },
    contact: { phone: "+86-138-0013-8000" },
    brandAssets: {
      logo: {
        status: "ready" as const,
        horizontal: "/images/logo.svg",
        width: 240,
        height: 72,
      },
    },
  },
};

export type PublicLaunchFixture = Omit<
  typeof READY_PUBLIC_LAUNCH_FIXTURE,
  "SINGLE_SITE_FACTS" | "SINGLE_SITE_CONFIG"
> & {
  SINGLE_SITE_CONFIG: import("@/config/site-types").SiteConfig;
  SINGLE_SITE_FACTS: {
    company?: import("@/config/site-types").CompanyInfo;
    contact: { phone?: string };
    brandAssets: {
      logo?: Partial<
        NonNullable<import("@/config/site-types").BrandAssets["logo"]>
      > & { status: string };
    };
  };
};
