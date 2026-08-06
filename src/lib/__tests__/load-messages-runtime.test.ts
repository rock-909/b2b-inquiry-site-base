import { afterEach, describe, expect, it, vi } from "vitest";

function createRuntimeEnvMock({
  ci = false,
  development = false,
  playwright = false,
  productionBuild = false,
  cloudflare = false,
}: {
  ci?: boolean;
  development?: boolean;
  playwright?: boolean;
  productionBuild?: boolean;
  cloudflare?: boolean;
}) {
  const env = {};

  return {
    env,
    runtimeEnv: env,
    isRuntimeCi: () => ci,
    isRuntimeDevelopment: () => development,
    isRuntimePlaywright: () => playwright,
    isRuntimeProduction: () => false,
    isRuntimeProductionBuildPhase: () => productionBuild,
    isRuntimeCloudflare: () => cloudflare,
  };
}

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
    productInquiry: {
      subject: string;
    };
  };
}

type FactualCompleteMessages = FactualSourceMessages;

const factualPlaceholderPattern = /\{(?:siteName|companyName|currentYear)\}/u;
const heroDiagramKeys = ["panelLabel", "ariaLabel", "caption"] as const;
const homeB2BSectionPaths = [
  ["home", "productLines", "title"],
  ["home", "productLines", "description"],
  ["home", "buyerSegments", "title"],
  ["home", "buyerSegments", "description"],
  ["home", "buyingProcess", "title"],
  ["home", "buyingProcess", "description"],
  ["home", "verify", "title"],
  ["home", "verify", "items", "audits", "title"],
  ["home", "verify", "items", "samples", "title"],
  ["home", "verify", "items", "inspection", "title"],
  ["home", "verify", "aboutLink"],
] as const;

const homeHeroProofPaths = [
  ["home", "hero", "proof", "quoteSla"],
  ["home", "hero", "proof", "quoteSlaLabel"],
  ["home", "hero", "proof", "warranty"],
  ["home", "hero", "proof", "warrantyLabel"],
  ["home", "hero", "proof", "factoryPool"],
  ["home", "hero", "proof", "factoryPoolLabel"],
  ["home", "hero", "proof", "oem"],
  ["home", "hero", "proof", "oemLabel"],
] as const;

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
  expectStringPath(value, ["emailTemplates", "productInquiry", "subject"]);
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/lib/env");
});

describe("load-messages runtime loading", () => {
  it("returns concrete factual brand values from complete message loading", async () => {
    vi.doMock("@/lib/env", () => createRuntimeEnvMock({ ci: true }));

    const [
      { loadCompleteMessages },
      { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS },
    ] = await Promise.all([
      import("@/lib/i18n/load-messages"),
      import("@/config/single-site"),
    ]);
    const currentYear = String(
      SINGLE_SITE_FACTS.company.established +
        SINGLE_SITE_FACTS.company.yearsInBusiness,
    );
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

  it("keeps homepage B2B proof copy in complete runtime messages", async () => {
    vi.doMock("@/lib/env", () => createRuntimeEnvMock({ ci: true }));

    const { loadCompleteMessages } = await import("@/lib/i18n/load-messages");

    const enMessages = await loadCompleteMessages("en");

    expect(getPathValue(enMessages, ["home", "hero", "proofAriaLabel"])).toBe(
      "Tucsenberg quote, warranty and factory-pool facts",
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

    for (const key of [
      "absFloodBarriers",
      "aluminumFloodGates",
      "absorbentFloodBags",
      "floodTubeDams",
      "frpFloodBarriers",
    ] as const) {
      expectStringPath(enMessages, [
        "home",
        "productLines",
        "items",
        key,
        "title",
      ]);
      expectStringPath(enMessages, [
        "home",
        "productLines",
        "items",
        key,
        "description",
      ]);
      expectStringPath(enMessages, [
        "home",
        "productLines",
        "items",
        key,
        "linkLabel",
      ]);
    }

    for (const key of [
      "dealersDistributors",
      "importersBrands",
      "contractorsProjects",
      "smallBusinessBuyers",
    ] as const) {
      expectStringPath(enMessages, [
        "home",
        "buyerSegments",
        "items",
        key,
        "title",
      ]);
      expectStringPath(enMessages, [
        "home",
        "buyerSegments",
        "items",
        key,
        "description",
      ]);
    }

    for (const key of [
      "sendRfq",
      "quoteResponse",
      "paidSample",
      "productionQc",
      "shipment",
    ] as const) {
      expectStringPath(enMessages, [
        "home",
        "buyingProcess",
        "items",
        key,
        "title",
      ]);
      expectStringPath(enMessages, [
        "home",
        "buyingProcess",
        "items",
        key,
        "description",
      ]);
    }
  });

  it("returns concrete structured-data names from complete source loading", async () => {
    vi.doMock("@/lib/env", () => createRuntimeEnvMock({ ci: true }));

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
    const { getComposedMessages } =
      await import("@/lib/i18n/composed-messages");
    const enMessages = getComposedMessages("en");
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

    expect(enMessages.emailTemplates.productInquiry.subject).toEqual(
      expect.any(String),
    );
    expect(enMessages).not.toHaveProperty("organization");
    expect(enMessages).not.toHaveProperty("website");
  });
});
