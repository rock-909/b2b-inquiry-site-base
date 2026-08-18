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

  it("keeps site identity out of env defaults and static page copy", () => {
    const envSources = [
      readFileSync(path.join(process.cwd(), "src/lib/env.ts"), "utf8"),
      readFileSync(
        path.join(process.cwd(), "src/lib/public-runtime-env.ts"),
        "utf8",
      ),
      readFileSync(path.join(process.cwd(), ".env.example"), "utf8"),
      readFileSync(path.join(process.cwd(), ".env.production"), "utf8"),
      readFileSync(path.join(process.cwd(), ".dev.vars.example"), "utf8"),
    ];
    const contactSource = readFileSync(
      path.join(process.cwd(), "src/content/pages/en/contact.ts"),
      "utf8",
    );

    for (const source of envSources) {
      expect(source).not.toContain("NEXT_PUBLIC_APP_NAME");
      expect(source).not.toContain("NEXT_PUBLIC_SITE_KEY");
    }
    expect(contactSource).not.toContain("Northstar Industrial Reference");
    expect(contactSource).not.toContain("sales@example.invalid");
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
