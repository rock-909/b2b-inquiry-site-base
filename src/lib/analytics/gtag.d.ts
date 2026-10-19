/**
 * Google Analytics 4 (gtag.js) TypeScript Declarations
 */

export interface GtagConfigParams {
  page_title?: string;
  page_location?: string;
  page_path?: string;
  send_page_view?: boolean;
  cookie_flags?: string;
  cookie_domain?: string;
  cookie_expires?: number;
  cookie_prefix?: string;
  cookie_update?: boolean;
  anonymize_ip?: boolean;
  allow_google_signals?: boolean;
  allow_ad_personalization_signals?: boolean;
}

export interface GtagEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  non_interaction?: boolean;
  // Custom dimensions
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: {
      (command: "js", date: Date): void;
      (command: "config", targetId: string, config?: GtagConfigParams): void;
      (
        command: "event",
        eventName: string,
        eventParams?: GtagEventParams,
      ): void;
      (command: "set", params: Record<string, unknown>): void;
      (
        command: "consent",
        action: "default" | "update",
        params: Record<string, string>,
      ): void;
      (...args: unknown[]): void;
    };
  }
}

export {};
