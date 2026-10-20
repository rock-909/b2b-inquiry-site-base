export const STARTER_PUBLIC_LAUNCH_FIXTURE = {
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
    company: {
      name: "Showcase Website Starter",
      location: {
        city: "Replace before launch",
        address: "Replace before launch",
      },
    },
    social: {
      twitter: "https://x.com/example",
      linkedin: "https://www.linkedin.com/company/example",
    },
    contact: {
      phone: "+86-518-0000-0000",
      email: "starter-contact@example.com",
    },
    brandAssets: {
      ogImage: "/opengraph-image.png",
      favicon: "/icon.svg",
      logo: { status: "pending" as const },
    },
  },
};

export const READY_PUBLIC_LAUNCH_FIXTURE = {
  SINGLE_SITE_CONFIG: {
    baseUrl: "https://reference-site.com",
    name: "Reference Industrial",
    description: "Industrial products and buyer support.",
    seo: {
      titleTemplate: "%s | Reference Industrial",
      defaultTitle: "Reference Industrial",
      defaultDescription: "Industrial products and buyer support.",
    },
    company: {
      name: "Reference Industrial LLC",
      location: { city: "New York", address: "1 Industrial Way" },
    },
    social: { twitter: "", linkedin: "" },
    contact: {
      phone: "+86-138-0013-8000",
      email: "sales@reference-site.com",
    },
    brandAssets: {
      ogImage: "/opengraph-image.png",
      favicon: "/icon.svg",
      logo: {
        status: "ready" as const,
        horizontal: "/images/logo.svg",
        width: 240,
        height: 72,
      },
    },
  },
};

type SiteConfig = import("@/config/site-types").SiteConfig;

// 门禁要能拦下形状不全的配置（如 pending 且缺尺寸的 logo），所以 logo 放宽为 Partial。
export interface PublicLaunchFixture {
  SINGLE_SITE_CONFIG: Omit<SiteConfig, "brandAssets"> & {
    brandAssets: Omit<SiteConfig["brandAssets"], "logo"> & {
      logo?: Partial<NonNullable<SiteConfig["brandAssets"]["logo"]>> & {
        status: string;
      };
    };
  };
}
