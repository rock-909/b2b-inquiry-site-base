import { PATHS_CONFIG } from "@/config/paths/paths-config";

export interface SingleSiteHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  requestQuote?: string;
  about?: string;
}

export const SINGLE_SITE_HOME_LINK_TARGETS = {
  primaryCta: PATHS_CONFIG.requestQuote,
  secondaryCta: PATHS_CONFIG.about,
  contact: PATHS_CONFIG.contact,
  requestQuote: PATHS_CONFIG.requestQuote,
  about: PATHS_CONFIG.about,
} satisfies SingleSiteHomeLinkTargets;
