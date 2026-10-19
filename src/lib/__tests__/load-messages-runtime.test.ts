import { describe, expect, it } from "vitest";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

// 消息不再做站点占位符替换：写进消息的 {siteName} 会原样显示给买家。
const SITE_PLACEHOLDER = /\{(?:siteName|currentYear)\}/u;

describe("load-messages runtime loading", () => {
  it("ships no site placeholders that would render literally", () => {
    for (const locale of LOCALES_CONFIG.locales) {
      expect(JSON.stringify(loadCompleteMessages(locale)), locale).not.toMatch(
        SITE_PLACEHOLDER,
      );
    }
  });

  it("keeps the neutral homepage copy in complete runtime messages", () => {
    const { home } = loadCompleteMessages("en") as {
      home: Record<string, unknown>;
    };

    for (const key of ["title", "description", "contactLink"]) {
      expect(home[key], key).toEqual(expect.stringMatching(/\S/u));
    }
  });
});
