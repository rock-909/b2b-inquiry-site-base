import { readFileSync } from "node:fs";
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

  it("documents the tooling locale config as a mirror, not the runtime truth", () => {
    const configSource = readFileSync("i18n-locales.config.js", "utf8");

    expect(configSource).toContain("LOCALES_CONFIG");
  });

  it("keeps product detail static params tied to canonical locales", () => {
    const source = readFileSync(
      "src/app/[locale]/products/[market]/page.tsx",
      "utf8",
    );

    expect(source).not.toContain('["en", "zh"]');
    expect(source).toContain("LOCALES_CONFIG.locales");
  });
});
