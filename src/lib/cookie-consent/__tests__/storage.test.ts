/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "@/lib/cookie-consent/types";
import { loadConsent } from "../storage";

const CONSENT = {
  necessary: true,
  analytics: true,
  marketing: false,
} as const;

describe("cookie consent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads the current stored shape", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        consent: CONSENT,
        updatedAt: "2026-08-09T00:00:00.000Z",
        version: CONSENT_VERSION,
      }),
    );

    expect(loadConsent()?.consent).toEqual(CONSENT);
  });

  it("drops unsupported versions instead of pretending to migrate them", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        consent: CONSENT,
        updatedAt: "2026-08-09T00:00:00.000Z",
        version: CONSENT_VERSION - 1,
      }),
    );

    expect(loadConsent()).toBeNull();
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });
});
