import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPrerenderStaticFindings } from "../../../scripts/quality/checks/prerender-static.js";

const tempDirs: string[] = [];
const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "tucsenberg-prerender-static-test-trash",
);

function moveTempDirToTrash(dir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup only inspects a test-owned temp directory
  if (!fs.existsSync(dir)) return;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
  fs.renameSync(
    dir,
    path.join(TEMP_TRASH_ROOT, `${path.basename(dir)}-${Date.now()}`),
  );
}

function writeJson(rootDir: string, relativePath: string, value: unknown) {
  const filePath = path.join(rootDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function createBuildFixture({
  aboutPostponed = false,
  contactPostponed = true,
  locales = ["en"],
  secondaryAboutPrerendered = true,
  includeAboutRoute = true,
  includeAboutTemplateMeta = true,
} = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-static-"));
  tempDirs.push(rootDir);
  writeJson(rootDir, ".next/server/app-paths-manifest.json", {
    "/[locale]/about/page": "app/[locale]/about/page.js",
    "/[locale]/contact/page": "app/[locale]/contact/page.js",
  });
  writeJson(rootDir, ".next/prerender-manifest.json", {
    routes: Object.fromEntries(
      locales.flatMap((locale) => [
        ...(includeAboutRoute
          ? [[`/${locale}/about`, { srcRoute: "/[locale]/about" }]]
          : []),
        [`/${locale}/contact`, { srcRoute: "/[locale]/contact" }],
      ]),
    ),
  });
  if (includeAboutTemplateMeta) {
    writeJson(rootDir, ".next/server/app/[locale]/about.meta", {
      headers: { "x-nextjs-prerender": "1" },
      postponed: "template shell",
    });
  }
  writeJson(rootDir, ".next/server/app/[locale]/contact.meta", {
    headers: { "x-nextjs-prerender": "1" },
    postponed: "template shell",
  });
  writeJson(rootDir, ".next/server/app/en/about.meta", {
    headers: { "x-nextjs-prerender": "1" },
    ...(aboutPostponed ? { postponed: "dynamic content" } : {}),
  });
  writeJson(rootDir, ".next/server/app/en/contact.meta", {
    headers: { "x-nextjs-prerender": "1" },
    ...(contactPostponed ? { postponed: "search params" } : {}),
  });
  for (const locale of locales.filter((value) => value !== "en")) {
    writeJson(rootDir, `.next/server/app/${locale}/about.meta`, {
      headers: secondaryAboutPrerendered ? { "x-nextjs-prerender": "1" } : {},
    });
    writeJson(rootDir, `.next/server/app/${locale}/contact.meta`, {
      headers: { "x-nextjs-prerender": "1" },
      ...(contactPostponed ? { postponed: "search params" } : {}),
    });
  }
  return rootDir;
}

function createRequestQuotePostponedFixture(locales: string[]) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-static-"));
  tempDirs.push(rootDir);
  writeJson(rootDir, ".next/server/app-paths-manifest.json", {
    "/[locale]/about/page": "app/[locale]/about/page.js",
    "/[locale]/contact/page": "app/[locale]/contact/page.js",
    "/[locale]/request-quote/page": "app/[locale]/request-quote/page.js",
  });
  writeJson(rootDir, ".next/prerender-manifest.json", {
    routes: Object.fromEntries(
      locales.flatMap((locale) => [
        [`/${locale}/about`, { srcRoute: "/[locale]/about" }],
        [`/${locale}/contact`, { srcRoute: "/[locale]/contact" }],
        [`/${locale}/request-quote`, { srcRoute: "/[locale]/request-quote" }],
      ]),
    ),
  });
  for (const templateRoute of ["about", "contact", "request-quote"]) {
    writeJson(rootDir, `.next/server/app/[locale]/${templateRoute}.meta`, {
      headers: { "x-nextjs-prerender": "1" },
      postponed: "template shell",
    });
  }
  for (const locale of locales) {
    writeJson(rootDir, `.next/server/app/${locale}/about.meta`, {
      headers: { "x-nextjs-prerender": "1" },
    });
    writeJson(rootDir, `.next/server/app/${locale}/contact.meta`, {
      headers: { "x-nextjs-prerender": "1" },
    });
    writeJson(rootDir, `.next/server/app/${locale}/request-quote.meta`, {
      headers: { "x-nextjs-prerender": "1" },
      postponed: "search params",
    });
  }
  return rootDir;
}

function createStaticBuildWithoutTemplateShellsFixture({
  includeAboutRoute = true,
} = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-static-"));
  tempDirs.push(rootDir);
  writeJson(rootDir, ".next/server/app-paths-manifest.json", {
    "/[locale]/about/page": "app/[locale]/about/page.js",
    "/[locale]/contact/page": "app/[locale]/contact/page.js",
    "/[locale]/request-quote/page": "app/[locale]/request-quote/page.js",
  });
  writeJson(rootDir, ".next/prerender-manifest.json", {
    routes: {
      ...(includeAboutRoute
        ? { "/en/about": { srcRoute: "/[locale]/about" } }
        : {}),
      "/en/contact": { srcRoute: "/[locale]/contact" },
    },
  });
  if (includeAboutRoute) {
    writeJson(rootDir, ".next/server/app/en/about.meta", {
      headers: { "x-nextjs-prerender": "1" },
    });
  }
  writeJson(rootDir, ".next/server/app/en/contact.meta", {
    headers: { "x-nextjs-prerender": "1" },
  });
  return rootDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveTempDirToTrash(tempDir);
  }
});

describe("prerender static behavior gate", () => {
  it("accepts fully prerendered locale templates without postponed exemptions", () => {
    expect(
      collectPrerenderStaticFindings({
        rootDir: createBuildFixture({ contactPostponed: false }),
        dynamicRouteExemptions: new Map(),
      }),
    ).toEqual([]);
  });

  it("rejects a localized page template without a prerender shell", () => {
    const findings = collectPrerenderStaticFindings({
      rootDir: createBuildFixture({ includeAboutTemplateMeta: false }),
    });
    expect(findings).toContainEqual({
      file: "server/app/[locale]/about.meta",
      error:
        'localized route template has no prerender shell "/[locale]/about"',
    });
  });

  it("rejects a localized page template without a concrete locale route", () => {
    const findings = collectPrerenderStaticFindings({
      rootDir: createBuildFixture({ includeAboutRoute: false }),
    });
    expect(findings).toContainEqual({
      file: "prerender-manifest.json",
      error:
        'localized route template has no prerender output for locale "en" "/[locale]/about"',
    });
  });

  it("rejects postponed rendering outside the explicit route exemption", () => {
    const findings = collectPrerenderStaticFindings({
      rootDir: createBuildFixture({ aboutPostponed: true }),
    });
    expect(findings).toContainEqual({
      file: "server/app/en/about.meta",
      error:
        'localized route unexpectedly keeps postponed rendering "/en/about"',
    });
  });

  it("checks every configured locale instead of only the default locale", () => {
    const findings = collectPrerenderStaticFindings({
      rootDir: createBuildFixture({
        locales: ["en", "fr"],
        secondaryAboutPrerendered: false,
      }),
      configuredLocales: ["en", "fr"],
      dynamicRouteExemptions: new Map([
        ["/en/contact", "contact search-param island"],
        ["/fr/contact", "contact search-param island"],
      ]),
    });

    expect(findings).toContainEqual({
      file: "server/app/fr/about.meta",
      error: 'localized route is not marked prerendered "/fr/about"',
    });
  });

  it("rejects stale route exemptions after the page becomes fully prerendered", () => {
    const findings = collectPrerenderStaticFindings({
      rootDir: createBuildFixture({ contactPostponed: false }),
      dynamicRouteExemptions: new Map([
        ["/en/contact", "contact search-param island; remove in M3-D2"],
      ]),
    });
    expect(findings).toContainEqual({
      file: "scripts/quality/checks/prerender-static.js",
      error: expect.stringContaining(
        'stale dynamic-route exemption "/en/contact"',
      ),
    });
  });

  it("accepts postponed Request Quote routes derived from configured locales", () => {
    expect(
      collectPrerenderStaticFindings({
        rootDir: createRequestQuotePostponedFixture(["en", "fr"]),
        configuredLocales: ["en", "fr"],
      }),
    ).toEqual([]);
  });

  it("accepts static output without PPR template shells and keeps Request Quote dynamic", () => {
    expect(
      collectPrerenderStaticFindings({
        rootDir: createStaticBuildWithoutTemplateShellsFixture(),
      }),
    ).toEqual([]);
  });

  it("still rejects a missing concrete static route without PPR template shells", () => {
    expect(
      collectPrerenderStaticFindings({
        rootDir: createStaticBuildWithoutTemplateShellsFixture({
          includeAboutRoute: false,
        }),
      }),
    ).toContainEqual({
      file: "prerender-manifest.json",
      error:
        'localized route template has no prerender output for locale "en" "/[locale]/about"',
    });
  });
});
