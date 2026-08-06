import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Storybook preview i18n contract", () => {
  it("loads composed physical-pack messages for component previews", () => {
    const messageSource = readFileSync(
      "src/lib/i18n/storybook-messages.ts",
      "utf8",
    );

    expect(messageSource).toContain('from "@/lib/i18n/composed-messages"');
    expect(messageSource).not.toContain("@messages/en/");
    expect(messageSource).not.toContain("@messages/en/critical.json");
    expect(messageSource).not.toContain("@messages/en/deferred.json");
    expect(messageSource).not.toContain("@messages/zh/");
    expect(messageSource).not.toMatch(
      /\.env|server-only|@\/lib\/env|NEXT_SERVER/u,
    );
  });

  it("wraps stories with next-intl client context for localized links and labels", () => {
    const preview = readFileSync(".storybook/preview.ts", "utf8");

    expect(preview).toContain(
      'import { NextIntlClientProvider } from "next-intl";',
    );
    expect(preview).toContain('from "@/lib/i18n/storybook-messages";');
    expect(preview).toContain("React.createElement(");
    expect(preview).toContain("NextIntlClientProvider");
    expect(preview).toContain("locale: storybookLocale");
    expect(preview).toContain(
      "messages: getStorybookMessages(storybookLocale)",
    );
  });

  it("uses runtime-equivalent deep message merging for duplicate namespaces", async () => {
    const { getStorybookMessages } =
      await import("@/lib/i18n/storybook-messages");

    const englishMessages = getStorybookMessages("en") as {
      "structured-data"?: {
        article?: { defaultAuthor?: string; defaultTitle?: string };
        organization?: { name?: string };
      };
    };

    expect(englishMessages["structured-data"]?.organization?.name).toBe(
      "{companyName}",
    );
    expect(englishMessages["structured-data"]?.article?.defaultAuthor).toBe(
      "{companyName}",
    );
    expect(
      englishMessages["structured-data"]?.article?.defaultTitle,
    ).toBeUndefined();
  });

  it("keeps Storybook previews on the active English locale", async () => {
    const { getStorybookMessages } =
      await import("@/lib/i18n/storybook-messages");
    const preview = readFileSync(".storybook/preview.ts", "utf8");
    const heroStories = readFileSync(
      "src/components/sections/hero-section.stories.tsx",
      "utf8",
    );
    const englishMessages = getStorybookMessages("en") as {
      "structured-data"?: { article?: { defaultAuthor?: string } };
    };

    expect(preview).toContain("context.globals.locale");
    expect(preview).toContain("getStorybookMessages(storybookLocale)");
    expect(preview).toContain('{ value: "en", title: "English" }');
    expect(preview).not.toContain('{ value: "zh", title: "中文" }');
    expect(englishMessages["structured-data"]?.article?.defaultAuthor).toBe(
      "{companyName}",
    );
    expect(heroStories).not.toContain('locale: "zh"');
  });
});
