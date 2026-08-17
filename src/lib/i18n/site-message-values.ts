import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";

export interface SiteMessageValues {
  siteName: string;
  companyName: string;
  currentYear: string;
}

// eslint-disable-next-line require-await -- Next Cache Components 要求 use cache 函数为 async。
export async function getSiteMessageValues(): Promise<SiteMessageValues> {
  "use cache";

  const currentYear = String(new Date().getUTCFullYear());

  return {
    siteName: SINGLE_SITE_CONFIG.name,
    companyName: SINGLE_SITE_FACTS.company.name,
    currentYear,
  };
}
