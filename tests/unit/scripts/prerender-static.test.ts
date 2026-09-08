import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";
import { collectPrerenderStaticFindings } from "../../../scripts/quality/checks/prerender-static.js";

const tempDirs: string[] = [];
const FIXTURE_PREFIX = "prerender-static-";
const EXPECTED_OG_IMAGE_URL = "https://example.invalid/opengraph-image.png";

function collectFindings(
  options: Parameters<typeof collectPrerenderStaticFindings>[0],
) {
  return collectPrerenderStaticFindings({
    ...options,
    expectedOgImageUrl: EXPECTED_OG_IMAGE_URL,
  });
}

function writeJson(rootDir: string, relativePath: string, value: unknown) {
  const filePath = path.join(rootDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function writeText(rootDir: string, relativePath: string, value: string) {
  const filePath = path.join(rootDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.writeFileSync(filePath, value);
}

function writeMetadataArtifacts({
  rootDir,
  rootNotFoundOgImage,
  homeOgImage = EXPECTED_OG_IMAGE_URL,
}: {
  rootDir: string;
  rootNotFoundOgImage?: string;
  homeOgImage?: string;
}) {
  writeText(
    rootDir,
    ".next/server/app/_not-found.html",
    `<html><head>${
      rootNotFoundOgImage
        ? `<meta property="og:image" content="${rootNotFoundOgImage}"/>`
        : ""
    }</head></html>`,
  );
  writeText(
    rootDir,
    ".next/server/app/en.html",
    `<html><head><meta property="og:image" content="${homeOgImage}"/></head></html>`,
  );
}

function createBuildFixture({
  aboutPostponed = false,
  contactPostponed = false,
  locales = ["en", "es"],
  secondaryAboutPrerendered = true,
  includeAboutRoute = true,
} = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
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
  writeMetadataArtifacts({ rootDir });
  return rootDir;
}

function createStaticBuildWithoutTemplateShellsFixture({
  includeAboutRoute = true,
} = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  tempDirs.push(rootDir);
  writeJson(rootDir, ".next/server/app-paths-manifest.json", {
    "/[locale]/about/page": "app/[locale]/about/page.js",
    "/[locale]/contact/page": "app/[locale]/contact/page.js",
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
  writeMetadataArtifacts({ rootDir });
  return rootDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

describe("prerender static behavior gate", () => {
  it("accepts fully prerendered locale routes", () => {
    expect(
      collectFindings({
        rootDir: createBuildFixture({ contactPostponed: false }),
      }),
    ).toEqual([]);
  });

  it("rejects a localized page template without a concrete locale route", () => {
    const findings = collectFindings({
      rootDir: createBuildFixture({ includeAboutRoute: false }),
    });
    expect(findings).toContainEqual({
      file: "prerender-manifest.json",
      error:
        'localized route template has no prerender output for locale "en" "/[locale]/about"',
    });
  });

  it("rejects postponed rendering", () => {
    const findings = collectFindings({
      rootDir: createBuildFixture({ aboutPostponed: true }),
    });
    expect(findings).toContainEqual({
      file: "server/app/en/about.meta",
      error:
        'localized route unexpectedly keeps postponed rendering "/en/about"',
    });
  });

  it("checks every configured locale instead of only the default locale", () => {
    const findings = collectFindings({
      rootDir: createBuildFixture({
        locales: ["en", "fr"],
        secondaryAboutPrerendered: false,
      }),
      configuredLocales: ["en", "fr"],
    });

    expect(findings).toContainEqual({
      file: "server/app/fr/about.meta",
      error: 'localized route is not marked prerendered "/fr/about"',
    });
  });

  it("still rejects a missing concrete static route without PPR template shells", () => {
    expect(
      collectFindings({
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

  it("rejects the root 404 localhost Open Graph fallback", () => {
    const rootDir = createStaticBuildWithoutTemplateShellsFixture();
    writeMetadataArtifacts({
      rootDir,
      rootNotFoundOgImage:
        "http://localhost:3000/opengraph-image.png?opengraph-image.123.png",
    });

    expect(
      collectFindings({
        rootDir,
      }),
    ).toContainEqual({
      file: "server/app/_not-found.html",
      error: "root 404 metadata contains the localhost Open Graph fallback",
    });
  });

  it("rejects a localized home without the configured Open Graph image", () => {
    const rootDir = createStaticBuildWithoutTemplateShellsFixture();
    writeMetadataArtifacts({
      rootDir,
      homeOgImage: "https://wrong.example/opengraph-image.png",
    });

    expect(
      collectFindings({
        rootDir,
      }),
    ).toContainEqual({
      file: "server/app/en.html",
      error: `localized home metadata is missing configured Open Graph image "${EXPECTED_OG_IMAGE_URL}"`,
    });
  });
});
