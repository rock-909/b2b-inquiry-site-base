import { PATHS_CONFIG } from "@/config/paths/paths-config";

export interface SingleSiteHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  about?: string;
}

// 首页主 CTA 直接指向询盘表单：站点只有一条转化路径，不再区分询价与咨询。
export const SINGLE_SITE_HOME_LINK_TARGETS = {
  primaryCta: PATHS_CONFIG.contact,
  secondaryCta: PATHS_CONFIG.about,
  contact: PATHS_CONFIG.contact,
  about: PATHS_CONFIG.about,
} satisfies SingleSiteHomeLinkTargets;
