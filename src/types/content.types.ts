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
  draft?: boolean;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

// Page specific metadata
export interface PageMetadata extends ContentMetadata {
  lastReviewed?: string;
  faq?: FaqItem[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface LegalPageMetadata extends PageMetadata {
  lastReviewed: string;
}

// Content with parsed frontmatter and content
export interface ParsedContent<T extends ContentMetadata = ContentMetadata> {
  metadata: T;
  content: string;
  slug: string;
  filePath: string;
}

// Page content
export interface Page extends ParsedContent<PageMetadata> {
  metadata: PageMetadata;
}

export type { Locale };
