import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/config/paths";
import { SINGLE_SITE_ROBOTS_DISALLOW_PATHS } from "@/config/single-site-seo";
import { getRuntimeAppEnv } from "@/lib/env";

// Base URL for the site - uses centralized SITE_CONFIG for consistency
const BASE_URL = SITE_CONFIG.baseUrl;

/**
 * Dynamic robots.txt generation for Next.js.
 * Configures search engine crawling rules.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = getRuntimeAppEnv() === "production";

  return {
    rules: [
      isProduction
        ? {
            userAgent: "*",
            allow: "/",
            disallow: [...SINGLE_SITE_ROBOTS_DISALLOW_PATHS],
          }
        : {
            userAgent: "*",
            disallow: "/",
          },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
