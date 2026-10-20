import { describe, expect, it } from "vitest";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

describe("load-messages canonical runtime source", () => {
  it("sanitizes invalid locale to default locale when loading messages", async () => {
    const invalidLocaleMessages = await loadCompleteMessages("invalid-locale");
    const defaultLocaleMessages = await loadCompleteMessages("en");

    expect(invalidLocaleMessages).toEqual(defaultLocaleMessages);
  });
});
