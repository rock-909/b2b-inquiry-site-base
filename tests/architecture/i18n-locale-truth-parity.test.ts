import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";

const require = createRequire(import.meta.url);
const translationCheckConfig = require("../../i18n-locales.config.js") as {
  locales: string[];
  defaultLocale: string;
};

describe("i18n locale truth parity", () => {
  it("keeps translation checks aligned with the runtime locale truth", () => {
    expect(translationCheckConfig.locales).toEqual(LOCALES_CONFIG.locales);
    expect(translationCheckConfig.defaultLocale).toBe(
      LOCALES_CONFIG.defaultLocale,
    );
  });

  it("uses the runtime configuration directly rather than a copied list", () => {
    const runtimeConfig = require("../../src/config/paths/locales-config.ts");
    expect(translationCheckConfig).toBe(runtimeConfig.LOCALES_CONFIG);
  });
});
