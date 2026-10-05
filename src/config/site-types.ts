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
  businessHours?: BusinessHours;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
}

export type PublicAssetStatus = "pending" | "ready";

export interface BrandAssets {
  logo: {
    status: PublicAssetStatus;
    horizontal: string;
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
