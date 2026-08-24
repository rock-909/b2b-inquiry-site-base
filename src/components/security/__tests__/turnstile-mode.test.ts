import { describe, expect, it } from "vitest";
import { resolveTurnstileWidgetMode } from "@/components/security/turnstile-mode";

function input(
  overrides: Partial<Parameters<typeof resolveTurnstileWidgetMode>[0]> = {},
) {
  return {
    siteKey: "site-key",
    isDevelopment: false,
    devBypassEnabled: false,
    testModeEnabled: false,
    appEnv: "production",
    isProductionBuild: true,
    ...overrides,
  };
}

describe("resolveTurnstileWidgetMode", () => {
  it("dev bypass wins over everything else", () => {
    expect(
      resolveTurnstileWidgetMode(
        input({ isDevelopment: true, devBypassEnabled: true }),
      ),
    ).toBe("bypass");
  });

  it("test mode requires non-production app env on a production build", () => {
    expect(
      resolveTurnstileWidgetMode(
        input({ testModeEnabled: true, appEnv: "preview" }),
      ),
    ).toBe("test");
    expect(
      resolveTurnstileWidgetMode(
        input({
          testModeEnabled: true,
          appEnv: "local",
          isProductionBuild: false,
        }),
      ),
    ).toBe("test");
  });

  it("rejects test mode when the deployment label claims production", () => {
    expect(
      resolveTurnstileWidgetMode(input({ testModeEnabled: true })),
    ).not.toBe("test");
  });

  it("falls back to live only with a site key", () => {
    expect(resolveTurnstileWidgetMode(input())).toBe("live");
    expect(resolveTurnstileWidgetMode(input({ siteKey: undefined }))).toBe(
      "unavailable",
    );
  });
});
