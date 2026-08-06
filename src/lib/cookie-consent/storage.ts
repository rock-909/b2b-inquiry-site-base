/**
 * Cookie Consent Storage Utilities
 *
 * Safe localStorage operations with SSR compatibility,
 * schema versioning, and type-safe parsing.
 */

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_CONSENT,
  type CookieConsent,
  type StoredConsent,
} from "@/lib/cookie-consent/types";

/** Check if localStorage is available (SSR-safe) */
function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const test = "__storage_test__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/** Validate consent object structure */
function isValidConsent(obj: unknown): obj is CookieConsent {
  if (typeof obj !== "object" || obj === null) return false;
  const consent = obj as Record<string, unknown>;
  return (
    consent.necessary === true &&
    typeof consent.analytics === "boolean" &&
    typeof consent.marketing === "boolean"
  );
}

/** Validate stored consent structure */
function isValidStoredConsent(obj: unknown): obj is StoredConsent {
  if (typeof obj !== "object" || obj === null) return false;
  const stored = obj as Record<string, unknown>;
  return (
    typeof stored.version === "number" &&
    typeof stored.updatedAt === "string" &&
    isValidConsent(stored.consent)
  );
}

/** Load consent from localStorage */
export function loadConsent(): StoredConsent | null {
  if (!isStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredConsent(parsed)) {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      return null;
    }

    // Handle version migrations if needed
    if (parsed.version < CONSENT_VERSION) {
      const migrated = migrateConsent(parsed);
      saveConsent(migrated.consent);
      return migrated;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    return null;
  }
}

/** Save consent to localStorage */
export function saveConsent(consent: CookieConsent): void {
  if (!isStorageAvailable()) return;

  const stored: StoredConsent = {
    consent,
    updatedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage quota exceeded or other error - fail silently
  }
}

/** Clear consent from localStorage */
export function clearConsent(): void {
  if (!isStorageAvailable()) return;

  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

/** Migrate consent from older versions */
function migrateConsent(stored: StoredConsent): StoredConsent {
  // Currently only version 1, future migrations go here
  return {
    ...stored,
    version: CONSENT_VERSION,
  };
}

/** Create consent with all optional categories accepted */
export function createAcceptAllConsent(): CookieConsent {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
  };
}

/** Create consent with all optional categories rejected */
export function createRejectAllConsent(): CookieConsent {
  return { ...DEFAULT_CONSENT };
}
