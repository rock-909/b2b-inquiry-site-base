import { afterEach, describe, expect, it, vi } from "vitest";

interface FactualSourceMessages {
  navigation: {
    siteName: string;
  };
  footer: {
    copyright: string;
  };
  "structured-data": {
    organization: {
      name: string;
    };
    website: {
      name: string;
    };
    article: {
      defaultAuthor: string;
    };
  };
  emailTemplates: {
    inquiry: {
      subject: string;
    };
  };
}

type FactualCompleteMessages = FactualSourceMessages;

const factualPlaceholderPattern = /\{(?:siteName|companyName|currentYear)\}/u;
const heroDiagramKeys = [] as const;
const homeB2BSectionPaths = [
  ["home", "value", "title"],
  ["home", "value", "description"],
  ["home", "finalCta", "title"],
  ["home", "finalCta", "description"],
  ["home", "finalCta", "primary"],
  ["home", "finalCta", "secondary"],
] as const;

const homeHeroProofPaths = [] as const;

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

function expectRecordPath(
  value: unknown,
  path: readonly string[],
): Record<string, unknown> {
  const record = getPathValue(value, path);

  expect(isRecord(record), path.join(".")).toBe(true);
  if (!isRecord(record)) {
    throw new Error(`${path.join(".")} should be an object`);
  }

  return record;
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
  expectStringPath(value, ["structured-data", "organization", "name"]);
  expectStringPath(value, ["structured-data", "website", "name"]);
  expectStringPath(value, ["structured-data", "article", "defaultAuthor"]);
}

function assertFactualCompleteMessages(
  value: unknown,
): asserts value is FactualCompleteMessages {
  assertFactualSourceMessages(value);
  expectStringPath(value, ["emailTemplates", "inquiry", "subject"]);
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("load-messages runtime loading", () => {
  it("returns concrete factual brand values from complete message loading", async () => {
    const [
      { loadCompleteMessages },
      { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS },
    ] = await Promise.all([
      import("@/lib/i18n/load-messages"),
      import("@/config/single-site"),
    ]);
    const currentYear = String(new Date().getUTCFullYear());
    const expectedEnCopyright = `© ${currentYear} ${SINGLE_SITE_CONFIG.name}. All rights reserved.`;
    const enMessages = await loadCompleteMessages("en");
    assertFactualSourceMessages(enMessages);

    expect(enMessages.navigation.siteName).toBe(SINGLE_SITE_CONFIG.name);
    expect(enMessages.footer.copyright).toBe(expectedEnCopyright);
    expect(enMessages["structured-data"].organization.name).toBe(
      SINGLE_SITE_FACTS.company.name,
    );
    expect(enMessages["structured-data"].website.name).toBe(
      SINGLE_SITE_CONFIG.name,
    );
    expect(enMessages["structured-data"].article.defaultAuthor).toBe(
      SINGLE_SITE_FACTS.company.name,
    );

    expect(JSON.stringify(enMessages)).not.toMatch(factualPlaceholderPattern);
  });

  it("keeps the neutral homepage copy in complete runtime messages", async () => {
    const { loadCompleteMessages } = await import("@/lib/i18n/load-messages");

    const enMessages = await loadCompleteMessages("en");

    expect(getPathValue(enMessages, ["home", "hero", "eyebrow"])).toBe(
      "B2B inquiry reference",
    );

    const enHero = expectRecordPath(enMessages, ["home", "hero"]);
    // The hero visual is the working-principle diagram; the retired
    // product-line preview card must not resurface in runtime messages.
    expect("preview" in enHero).toBe(false);

    for (const diagramKey of heroDiagramKeys) {
      expectNonEmptyStringPath(enMessages, [
        "home",
        "hero",
        "diagram",
        diagramKey,
      ]);
    }

    for (const path of homeB2BSectionPaths) {
      expectNonEmptyStringPath(enMessages, path);
    }

    for (const path of homeHeroProofPaths) {
      expectNonEmptyStringPath(enMessages, path);
    }
  });

  it("returns concrete structured-data names from complete source loading", async () => {
    const [
      { loadCompleteMessages },
      { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS },
    ] = await Promise.all([
      import("@/lib/i18n/load-messages"),
      import("@/config/single-site"),
    ]);

    const [messages] = await Promise.all([loadCompleteMessages("en")]);
    assertFactualCompleteMessages(messages);

    expect(messages["structured-data"].organization.name).toBe(
      SINGLE_SITE_FACTS.company.name,
    );
    expect(messages["structured-data"].website.name).toBe(
      SINGLE_SITE_CONFIG.name,
    );
    expect(messages["structured-data"].article.defaultAuthor).toBe(
      SINGLE_SITE_FACTS.company.name,
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

    expect(enMessages["structured-data"].organization.name).toBe(
      "{companyName}",
    );
    expect(enMessages["structured-data"].website.name).toBe("{siteName}");
    expect(enMessages["structured-data"].article.defaultAuthor).toBe(
      "{companyName}",
    );

    expect(enMessages.emailTemplates.inquiry.subject).toEqual(
      expect.any(String),
    );
    expect(enMessages).not.toHaveProperty("organization");
    expect(enMessages).not.toHaveProperty("website");
  });
});
