import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("base identity", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("uses the neutral template package name", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { name?: unknown };

    expect(packageJson.name).toBe("b2b-inquiry-site-base");
  });

  it("uses the obvious non-production reference identity", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_BASE_URL: undefined,
        NEXT_PUBLIC_SITE_URL: undefined,
      },
      runtimeEnv: {
        NEXT_PUBLIC_BASE_URL: undefined,
        NEXT_PUBLIC_SITE_URL: undefined,
      },
      getRuntimeEnvString: () => undefined,
      isRuntimeProduction: () => true,
    }));

    const { SINGLE_SITE_CONFIG } = await import("@/config/single-site");

    expect(SINGLE_SITE_CONFIG.name).toBe("Northstar Industrial Reference");
    expect(SINGLE_SITE_CONFIG.baseUrl).toBe("https://example.invalid");
    expect(SINGLE_SITE_CONFIG.contact.email).toBe("sales@example.invalid");
  });
});
