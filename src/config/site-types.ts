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

import type { NavigationNamespaceKey } from "@/config/pages.config";

export interface SiteNavigationItem {
  key: string;
  href: string;
  messageKey: NavigationNamespaceKey;
}
