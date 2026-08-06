/**
 * Content Management System Types
 *
 * This file defines TypeScript interfaces for the MDX content management system,
 * ensuring type safety across the application.
 */

import type { TucsenbergProductStandardId } from "@/config/site-types";
import type { Locale } from "@/i18n/routing-config";

// Base content metadata interface
export interface ContentMetadata {
  title: string;
  description?: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
  categories?: string[];
  featured?: boolean;
  draft?: boolean;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

// Page specific metadata
export interface PageMetadata extends ContentMetadata {
  layout?: "default" | "landing" | "docs" | "legal";
  showToc?: boolean;
  lastReviewed?: string;
  faq?: FaqItem[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  aboutSections?: AboutPageSections;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface AboutPageSections {
  valuesTitle: string;
  values: Record<string, { title: string; description: string }>;
  statLabels: Record<string, string>;
  cta: {
    title: string;
    description: string;
    button: string;
  };
}

export interface LegalPageMetadata extends PageMetadata {
  layout: "legal";
  showToc: true;
  lastReviewed: string;
}

// Content with parsed frontmatter and content
export interface ParsedContent<T extends ContentMetadata = ContentMetadata> {
  metadata: T;
  content: string;
  excerpt?: string;
  slug: string;
  filePath: string;
}

// Page content
export interface Page extends ParsedContent<PageMetadata> {
  metadata: PageMetadata;
}

// Product specific metadata (for MDX frontmatter)
export interface ProductMetadata extends ContentMetadata {
  coverImage: string;
  images?: string[];
  category: string;
  standards?: TucsenbergProductStandardId[];
  pdfUrl?: string;
  moq?: string;
  leadTime?: string;
  supplyCapacity?: string;
  specs?: Record<string, string>;
  certifications?: string[];
  packaging?: string;
  portOfLoading?: string;
  relatedProducts?: string[];
}

// Product content
/**
 * @public Content contract for MDX product pages.
 */
export interface Product extends ParsedContent<ProductMetadata> {
  metadata: ProductMetadata;
}

export type { Locale };

/**
 * Summary view of a product for listing and overview sections.
 *
 * Designed for B2B/foreign trade scenarios with common fields that most
 * industries need. Additional fields can be added via the `specs` record.
 */
export interface ProductSummary {
  slug: string;
  locale: Locale;
  title: string;
  description?: string;
  coverImage: string;
  images?: string[];
  category: string;
  standards?: TucsenbergProductStandardId[];
  pdfUrl?: string;
  categories?: string[];
  tags?: string[];
  featured?: boolean;

  // Timestamps for SEO (sitemap lastmod)
  publishedAt: string;
  updatedAt?: string;

  // Foreign trade common fields (optional)
  moq?: string; // Minimum Order Quantity, e.g. "100 pieces"
  leadTime?: string; // Delivery time, e.g. "15-30 days"
  supplyCapacity?: string; // e.g. "10000 pieces/month"

  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

/**
 * Detail view of a product for dedicated product pages.
 *
 * Includes full content and extensible specs for industry-specific attributes.
 */
export interface ProductDetail extends ProductSummary {
  content: string;
  filePath: string;

  // Extensible key-value specs for industry-specific attributes
  specs?: Record<string, string>;

  // Certifications like ISO, CE, etc.
  certifications?: string[];

  // Packaging and shipping info
  packaging?: string;
  portOfLoading?: string;

  // Related products by slug
  relatedProducts?: string[];
}

/**
 * Options for product listing queries.
 */
export interface ProductListOptions {
  limit?: number;
  offset?: number;
  category?: string;
  tags?: string[];
  standards?: TucsenbergProductStandardId[];
  featured?: boolean;
}

// Content validation result
export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
