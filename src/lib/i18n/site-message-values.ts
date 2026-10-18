import { SINGLE_SITE_CONFIG } from "@/config/single-site";

export type SiteMessageValues = {
  siteName: string;
  currentYear: string;
};

export function getSiteMessageValues(): SiteMessageValues {
  const currentYear = String(new Date().getUTCFullYear());

  return {
    siteName: SINGLE_SITE_CONFIG.name,
    currentYear,
  };
}
