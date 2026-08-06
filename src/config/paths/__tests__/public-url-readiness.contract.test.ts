import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBaseUrlConfigured } from "@/config/paths/site-config";

const require = createRequire(import.meta.url);
const {
  isPublicBaseUrlReady,
  PUBLIC_BASE_URL_FIXTURES,
}: {
  isPublicBaseUrlReady: (baseUrl: string) => boolean;
  PUBLIC_BASE_URL_FIXTURES: {
    rejected: string[];
    accepted: string[];
  };
} = require("../../../../scripts/quality/public-url-readiness.js");

describe("public URL readiness shared contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the pure helper and isBaseUrlConfigured aligned on fixtures", () => {
    for (const url of PUBLIC_BASE_URL_FIXTURES.rejected) {
      expect(isPublicBaseUrlReady(url), url).toBe(false);
    }
    for (const url of PUBLIC_BASE_URL_FIXTURES.accepted) {
      expect(isPublicBaseUrlReady(url), url).toBe(true);
    }

    // isBaseUrlConfigured only enforces in production (and with gates off)
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.PLAYWRIGHT_TEST;
    delete process.env.SKIP_ENV_VALIDATION;

    for (const url of PUBLIC_BASE_URL_FIXTURES.rejected) {
      expect(isBaseUrlConfigured(url), `isBaseUrlConfigured ${url}`).toBe(
        false,
      );
    }
    for (const url of PUBLIC_BASE_URL_FIXTURES.accepted) {
      expect(isBaseUrlConfigured(url), `isBaseUrlConfigured ${url}`).toBe(true);
    }
  });
});
