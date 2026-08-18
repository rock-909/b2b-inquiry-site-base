/**
 * Content Management System Types
 *
 * This file defines TypeScript interfaces for static page content,
 * ensuring type safety across the application.
 */

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

export type { Locale };

// Content validation result
export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
