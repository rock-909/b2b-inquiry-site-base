import { afterEach, describe, expect, it, vi } from "vitest";

interface FactualSourceMessages {
  navigation: {
    siteName: string;
  };
  footer: {
    copyright: string;
  };
  "structured-data": {
    website: {
      name: string;
    };
  };
  emailTemplates: {
    inquiry: {
      subject: string;
    };
  };
}

type FactualCompleteMessages = FactualSourceMessages;

const factualPlaceholderPattern =
  /\{(?:siteName|companyName|established|currentYear)\}/u;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getPathValue(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function expectStringPath(value: unknown, path: readonly string[]): void {
  expect(getPathValue(value, path), path.join(".")).toEqual(expect.any(String));
}

function expectNonEmptyStringPath(
  value: unknown,
  path: readonly string[],
): void {
  const pathValue = getPathValue(value, path);

  expect(pathValue, path.join(".")).toEqual(expect.any(String));
  if (typeof pathValue !== "string") return;
  expect(pathValue.trim().length, path.join(".")).toBeGreaterThan(0);
}

function assertFactualSourceMessages(
  value: unknown,
): asserts value is FactualSourceMessages {
  expectStringPath(value, ["navigation", "siteName"]);
  expectStringPath(value, ["footer", "copyright"]);
  expectStringPath(value, ["structured-data", "website", "name"]);
}

function assertFactualCompleteMessages(
  value: unknown,
): asserts value is FactualCompleteMessages {
  assertFactualSourceMessages(value);
  expectStringPath(value, ["emailTemplates", "inquiry", "subject"]);
}

afterEach(() => {
  vi.doUnmock("@messages/base/en/messages.json");
  vi.resetModules();
  vi.clearAllMocks();
});

describe("load-messages runtime loading", () => {
  it("returns concrete factual brand values from complete message loading", async () => {
    const [{ loadCompleteMessages }, { SINGLE_SITE_CONFIG }] =
      await Promise.all([
        import("@/lib/i18n/load-messages"),
        import("@/config/single-site"),
      ]);
    const currentYear = String(new Date().getUTCFullYear());
    const expectedEnCopyright = `© ${currentYear} ${SINGLE_SITE_CONFIG.name}. All rights reserved.`;
    const enMessages = await loadCompleteMessages("en");
    assertFactualSourceMessages(enMessages);

    expect(enMessages.navigation.siteName).toBe(SINGLE_SITE_CONFIG.name);
    expect(enMessages.footer.copyright).toBe(expectedEnCopyright);
    expect(enMessages["structured-data"].website.name).toBe(
      SINGLE_SITE_CONFIG.name,
    );

    expect(JSON.stringify(enMessages)).not.toMatch(factualPlaceholderPattern);
  });

  it("replaces every site placeholder in messages and leaves call-time ones alone", async () => {
    vi.doMock("@messages/base/en/messages.json", async (importOriginal) => {
      const actual = await importOriginal<{
        default: Record<string, unknown>;
      }>();

      return {
        default: {
          ...actual.default,
          probe: { text: "In {currentYear} for {productName}" },
        },
      };
    });
    const { loadCompleteMessages } = await import("@/lib/i18n/load-messages");

    const messages = (await loadCompleteMessages("en")) as {
      probe: { text: string };
    };

    expect(messages.probe.text).toBe(
      `In ${new Date().getUTCFullYear()} for {productName}`,
    );
  });

  it("keeps the neutral homepage copy in complete runtime messages", async () => {
    const { loadCompleteMessages } = await import("@/lib/i18n/load-messages");

    const enMessages = await loadCompleteMessages("en");

    for (const key of ["title", "description", "contactLink"]) {
      expectNonEmptyStringPath(enMessages, ["home", key]);
    }
  });

  it("returns concrete structured-data names from complete source loading", async () => {
    const [{ loadCompleteMessages }, { SINGLE_SITE_CONFIG }] =
      await Promise.all([
        import("@/lib/i18n/load-messages"),
        import("@/config/single-site"),
      ]);

    const [messages] = await Promise.all([loadCompleteMessages("en")]);
    assertFactualCompleteMessages(messages);

    expect(messages["structured-data"].website.name).toBe(
      SINGLE_SITE_CONFIG.name,
    );
    expect(messages).not.toHaveProperty("organization");
    expect(messages).not.toHaveProperty("website");
    expect(JSON.stringify(messages)).not.toMatch(factualPlaceholderPattern);
  });

  it("keeps factual brand values as placeholders in source JSON", async () => {
    const { getSourceMessages } = await import("@/lib/i18n/load-messages");
    const enMessages = getSourceMessages("en");
    assertFactualCompleteMessages(enMessages);

    expect(enMessages.navigation.siteName).toBe("{siteName}");
    expect(enMessages.footer.copyright).toBe(
      "© {currentYear} {siteName}. All rights reserved.",
    );

    expect(enMessages["structured-data"].website.name).toBe("{siteName}");

    expect(enMessages.emailTemplates.inquiry.subject).toEqual(
      expect.any(String),
    );
    expect(enMessages).not.toHaveProperty("organization");
    expect(enMessages).not.toHaveProperty("website");
  });
});
