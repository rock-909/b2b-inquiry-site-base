import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSingleSitePublicStaticPages } from "@/config/single-site-seo";

interface LighthouseConfig {
  ci: {
    collect: { url: string[] };
    assert: { assertMatrix: Array<{ assertions: Record<string, unknown> }> };
  };
}

function loadConfig(daily: boolean): LighthouseConfig {
  const previous = process.env.CI_DAILY;
  process.env.CI_DAILY = daily ? "true" : "";
  const require = createRequire(import.meta.url);
  const configPath = join(process.cwd(), "lighthouserc.js");
  delete require.cache[require.resolve(configPath)];

  try {
    return require(configPath) as LighthouseConfig;
  } finally {
    if (previous === undefined) delete process.env.CI_DAILY;
    else process.env.CI_DAILY = previous;
  }
}

describe("lighthouse route contract", () => {
  it("audits every core route in the daily sweep", () => {
    const paths = loadConfig(true).ci.collect.url.map(
      (url) => new URL(url).pathname,
    );
    const expected = getSingleSitePublicStaticPages().map(
      (path) => path || "/",
    );

    expect([...paths].sort()).toEqual([...expected].sort());
  });

  it("keeps the normal run on home and applies SEO assertions to all pages", () => {
    expect(
      loadConfig(false).ci.collect.url.map((url) => new URL(url).pathname),
    ).toEqual(["/"]);
    expect(loadConfig(true).ci.assert.assertMatrix).toHaveLength(1);
    expect(
      loadConfig(true).ci.assert.assertMatrix[0]?.assertions,
    ).toHaveProperty("categories:seo");
  });
});
