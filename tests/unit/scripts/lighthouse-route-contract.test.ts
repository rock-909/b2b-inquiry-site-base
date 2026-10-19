import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";

interface LighthouseConfig {
  ci: {
    collect: { url: string[] };
    assert: {
      assertMatrix: Array<{
        matchingUrlPattern: string;
        assertions: Record<string, unknown>;
      }>;
    };
  };
}

function loadConfig(fullCoverage: boolean): LighthouseConfig {
  const previous = process.env.CI_FULL_COVERAGE;
  process.env.CI_FULL_COVERAGE = fullCoverage ? "true" : "";
  const require = createRequire(import.meta.url);
  const configPath = join(process.cwd(), "lighthouserc.js");
  delete require.cache[require.resolve(configPath)];

  try {
    return require(configPath) as LighthouseConfig;
  } finally {
    if (previous === undefined) delete process.env.CI_FULL_COVERAGE;
    else process.env.CI_FULL_COVERAGE = previous;
  }
}

describe("lighthouse route contract", () => {
  it("keeps the normal run on home and applies SEO assertions to all pages", () => {
    expect(
      loadConfig(false).ci.collect.url.map((url) => new URL(url).pathname),
    ).toEqual(["/"]);

    const { collect, assert } = loadConfig(true).ci;
    expect(collect.url.map((url) => new URL(url).pathname).sort()).toEqual(
      PUBLIC_STATIC_PAGE_DEFINITIONS.map(({ path }) => path).sort(),
    );
    for (const url of collect.url) {
      const matching = assert.assertMatrix.filter(({ matchingUrlPattern }) =>
        // eslint-disable-next-line security/detect-non-literal-regexp -- pattern comes from the repo's own lighthouserc.js
        new RegExp(matchingUrlPattern).test(url),
      );
      expect(
        matching.some(({ assertions }) => "categories:seo" in assertions),
        url,
      ).toBe(true);
    }
  });
});
