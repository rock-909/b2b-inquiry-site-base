import { describe, expect, it, vi } from "vitest";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

describe("load-messages canonical runtime source", () => {
  it("sanitizes invalid locale to default locale when loading messages", async () => {
    const invalidLocaleMessages = await loadCompleteMessages("invalid-locale");
    const defaultLocaleMessages = await loadCompleteMessages("en");

    expect(invalidLocaleMessages).toEqual(defaultLocaleMessages);
  });

  it("returns merged complete messages from physical packs", async () => {
    const messages = await loadCompleteMessages("en");

    expect(messages).toHaveProperty("apiErrors");
    expect(messages).toHaveProperty("catalog");
    expect(messages).toHaveProperty("contact");
    expect(messages).toHaveProperty("emailTemplates");
    expect(messages).toHaveProperty("home");
    expect(messages).toHaveProperty("requestQuote");
    expect(messages).not.toHaveProperty("common");
    expect(messages).not.toHaveProperty("blog");
    expect(messages).not.toHaveProperty("customProject");
    expect(messages).not.toHaveProperty("language");
    expect(messages).not.toHaveProperty("products");
  });

  it("uses the shared composed packs without site-specific overlay drift", async () => {
    vi.resetModules();

    const messages = (await loadCompleteMessages("en")) as {
      seo?: unknown;
      footer?: { description?: string };
      home?: { hero?: { title?: string } };
    };

    expect(messages.seo).toBeUndefined();
    expect(messages.footer?.description).toBeTruthy();
    expect(messages.home?.hero?.title).toBeTruthy();
  });
});
