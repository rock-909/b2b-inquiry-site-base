import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";

export interface SiteMessageValues {
  siteName: string;
  companyName: string;
  currentYear: string;
}

export function getSiteMessageValues(): SiteMessageValues {
  const currentYear = String(new Date().getUTCFullYear());

  return {
    siteName: SINGLE_SITE_CONFIG.name,
    companyName: SINGLE_SITE_FACTS.company.name,
    currentYear,
  };
}
