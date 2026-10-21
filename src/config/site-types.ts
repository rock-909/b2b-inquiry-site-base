export interface SiteSeoConfig {
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
}

export interface CompanyInfo {
  name: string;
  established?: number;
  location?: {
    country?: string;
    city?: string;
    address?: string;
  };
}

export interface ContactInfo {
  phone?: string;
  email: string;
  // 国际格式（+国家码 号码），页面显示为 wa.me 链接。
  whatsapp?: string;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
}

export type PublicAssetStatus = "pending" | "ready";

export interface BrandAssets {
  logo?: {
    status: PublicAssetStatus;
    horizontal: string;
    width: number;
    height: number;
  };
  ogImage: string;
  favicon: string;
}

// 站点身份的唯一配置形状：页头、页脚、metadata、结构化数据都读它。
// 可选字段留空即不展示、不进结构化数据；占位判断只在上线门禁里做。
export interface SiteConfig {
  baseUrl: string;
  name: string;
  description: string;
  seo: SiteSeoConfig;
  company?: CompanyInfo;
  contact: ContactInfo;
  social: SocialLinks;
  brandAssets: BrandAssets;
}

import type enBaseMessages from "@messages/base/en/messages.json";

// 导航文案都在 messages 的 navigation 命名空间里；新增 key 后类型检查自动放行。
export type NavigationLabelKey = keyof (typeof enBaseMessages)["navigation"];

export interface SiteNavigationLink {
  key: string;
  // 站内链接用 PATHS_CONFIG[pageType]；站外链接写完整 URL 并设 external。
  href: string;
  messageKey: NavigationLabelKey;
  // 新标签页打开并显示 ↗。
  external?: boolean;
}

export interface SiteNavigationGroup {
  key: string;
  messageKey: NavigationLabelKey;
  links: readonly SiteNavigationLink[];
}

// 带 groups 的项是展开二级菜单的按钮，本身不跳转（同 Vercel）。
export type SiteNavigationItem =
  | {
      key: string;
      messageKey: NavigationLabelKey;
      href: string;
      groups?: never;
    }
  | {
      key: string;
      messageKey: NavigationLabelKey;
      href?: never;
      groups: readonly SiteNavigationGroup[];
    };
