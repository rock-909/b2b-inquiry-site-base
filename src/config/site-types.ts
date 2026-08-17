/**
 * Site key is an authoring input, not a hardcoded repository-wide demo identity.
 * The current single-site baseline keeps its concrete key in `single-site.ts`,
 * so derivative projects replace that input without editing shared type
 * definitions.
 */
export type SiteKey = string;

export interface SiteSeoConfig {
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
}

export interface SiteSocialConfig {
  twitter: string;
  linkedin: string;
}

export interface SiteContactConfig {
  phone: string;
  email: string;
}

export interface SiteConfig {
  baseUrl: string;
  name: string;
  description: string;
  seo: SiteSeoConfig;
  social: SiteSocialConfig;
  contact: SiteContactConfig;
}

export interface CompanyInfo {
  name: string;
  established: number;
  location: {
    country: string;
    city: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface BusinessHours {
  weekdays: string;
  saturday: string;
  sundayClosed: boolean;
}

export interface ContactInfo {
  phone: string;
  email: string;
  wechat?: string;
  businessHours?: BusinessHours;
}

export interface SocialLinks {
  linkedin?: string;
  facebook?: string;
  youtube?: string;
  twitter?: string;
  instagram?: string;
}

export type PublicAssetStatus = "pending" | "ready";

export interface BrandAssets {
  logo: {
    status: PublicAssetStatus;
    horizontal: string;
    horizontalPng: string;
    square: string;
    width: number;
    height: number;
  };
  ogImage: string;
  favicon: string;
}

export interface SiteFacts {
  company: CompanyInfo;
  contact: ContactInfo;
  social: SocialLinks;
  brandAssets: BrandAssets;
}

import type { NavigationNamespaceKey } from "@/config/pages.config";

export interface SiteNavigationItem {
  key: string;
  href: string;
  messageKey: NavigationNamespaceKey;
  icon?: string;
  external?: boolean;
  children?: SiteNavigationItem[];
}

export interface SiteFooterLinkItem {
  key: string;
  href: string;
  external?: boolean;
  showExternalIcon?: boolean;
  translationKey: string;
}

export interface SiteFooterColumnConfig {
  key: string;
  translationKey: string;
  links: readonly SiteFooterLinkItem[];
}

export interface SiteDefinition {
  key: SiteKey;
  config: SiteConfig;
  facts: SiteFacts;
  navigation: {
    main: SiteNavigationItem[];
  };
  footerColumns: readonly SiteFooterColumnConfig[];
}
