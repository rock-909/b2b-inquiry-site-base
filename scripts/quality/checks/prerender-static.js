const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const {
  locales: CONFIGURED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
} = require("../../../i18n-locales.config");
const DEFAULT_BUILD_DIR = ".next";
const DEFAULT_SITE_URL = "https://example.invalid";
const LOCALHOST_OG_IMAGE_PREFIX = "http://localhost:3000/opengraph-image";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getMetaRelativePath(route) {
  const suffix = route === "/" ? "" : route;
  return path.posix.join("server/app", `${suffix}.meta`);
}

function isPrerenderedMeta(meta) {
  return meta?.headers?.["x-nextjs-prerender"] === "1";
}

function collectMissingManifestFindings(rootDir, requiredPaths) {
  return requiredPaths
    .filter((requiredPath) => !fs.existsSync(requiredPath))
    .map((requiredPath) => ({
      file: path.relative(rootDir, requiredPath),
      error: "missing Next.js build manifest; run pnpm build first",
    }));
}

function routeUsesLocale(route, locale) {
  return route === `/${locale}` || route.startsWith(`/${locale}/`);
}

function collectTemplateRouteFindings(
  localizedPageTemplates,
  localizedRoutes,
  configuredLocales,
) {
  const findings = [];
  for (const locale of configuredLocales) {
    const prerenderedTemplates = new Set(
      localizedRoutes
        .filter(([route]) => routeUsesLocale(route, locale))
        .map(([, config]) => config.srcRoute),
    );
    for (const route of localizedPageTemplates) {
      if (prerenderedTemplates.has(route)) continue;
      findings.push({
        file: "prerender-manifest.json",
        error: `localized route template has no prerender output for locale "${locale}" "${route}"`,
      });
    }
  }
  return findings;
}

function collectLocalizedRouteFindings({ buildRoot, localizedRoutes }) {
  const findings = [];
  for (const [route] of localizedRoutes) {
    const metaRelativePath = getMetaRelativePath(route);
    const metaPath = path.join(buildRoot, metaRelativePath);
    if (!fs.existsSync(metaPath)) {
      findings.push({
        file: metaRelativePath,
        error: `localized route has no prerender output "${route}"`,
      });
      continue;
    }

    const meta = readJson(metaPath);
    if (!isPrerenderedMeta(meta)) {
      findings.push({
        file: metaRelativePath,
        error: `localized route is not marked prerendered "${route}"`,
      });
    }
    if (typeof meta.postponed !== "string") continue;

    findings.push({
      file: metaRelativePath,
      error: `localized route unexpectedly keeps postponed rendering "${route}"`,
    });
  }
  return findings;
}

function loadExpectedOgImageUrl() {
  require("tsx/cjs");
  const { SINGLE_SITE_FACTS } = require("../../../src/config/single-site");
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const baseUrl =
    configuredSiteUrl && configuredSiteUrl !== "http://localhost:3000"
      ? configuredSiteUrl
      : DEFAULT_SITE_URL;

  return new URL(SINGLE_SITE_FACTS.brandAssets.ogImage, baseUrl).toString();
}

function hasMetaContent(html, attribute, name, expectedContent) {
  const encodedContent = expectedContent
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return [...html.matchAll(/<meta\b[^>]*>/giu)].some(
    ([tag]) =>
      tag.includes(`${attribute}="${name}"`) &&
      tag.includes(`content="${encodedContent}"`),
  );
}

function collectMetadataFindings(
  buildRoot,
  metadataLocale,
  expectedOgImageUrl,
) {
  const findings = [];
  const notFoundRelativePath = "server/app/_not-found.html";
  const homeRelativePath = `server/app/${metadataLocale}.html`;
  const notFoundPath = path.join(buildRoot, notFoundRelativePath);
  const homePath = path.join(buildRoot, homeRelativePath);

  for (const [relativePath, filePath] of [
    [notFoundRelativePath, notFoundPath],
    [homeRelativePath, homePath],
  ]) {
    if (!fs.existsSync(filePath)) {
      findings.push({
        file: relativePath,
        error: "missing prerendered HTML metadata artifact",
      });
    }
  }
  if (findings.length > 0) return findings;

  const notFoundHtml = fs.readFileSync(notFoundPath, "utf8");
  if (notFoundHtml.includes(LOCALHOST_OG_IMAGE_PREFIX)) {
    findings.push({
      file: notFoundRelativePath,
      error: "root 404 metadata contains the localhost Open Graph fallback",
    });
  }

  const homeHtml = fs.readFileSync(homePath, "utf8");
  if (!hasMetaContent(homeHtml, "property", "og:image", expectedOgImageUrl)) {
    findings.push({
      file: homeRelativePath,
      error: `localized home metadata is missing configured Open Graph image "${expectedOgImageUrl}"`,
    });
  }

  return findings;
}

/**
 * @param {{
 *   rootDir?: string,
 *   buildDir?: string,
 *   configuredLocales?: string[],
 *   metadataLocale?: string,
 *   expectedOgImageUrl?: string,
 * }=} options
 */
function collectPrerenderStaticFindings({
  rootDir = ROOT,
  buildDir = DEFAULT_BUILD_DIR,
  configuredLocales = CONFIGURED_LOCALES,
  metadataLocale = DEFAULT_LOCALE,
  expectedOgImageUrl = loadExpectedOgImageUrl(),
} = {}) {
  const buildRoot = path.join(rootDir, buildDir);
  const appPathsPath = path.join(buildRoot, "server/app-paths-manifest.json");
  const prerenderPath = path.join(buildRoot, "prerender-manifest.json");
  const missingManifestFindings = collectMissingManifestFindings(rootDir, [
    appPathsPath,
    prerenderPath,
  ]);
  if (missingManifestFindings.length > 0) return missingManifestFindings;

  const appPaths = readJson(appPathsPath);
  const prerenderManifest = readJson(prerenderPath);
  const localizedPageTemplates = Object.keys(appPaths)
    .filter((route) => route.startsWith("/[locale]") && route.endsWith("/page"))
    .map((route) => route.slice(0, -"/page".length))
    .sort();

  const localizedRoutes = Object.entries(prerenderManifest.routes ?? {})
    .filter(
      ([route, config]) =>
        configuredLocales.some((locale) => routeUsesLocale(route, locale)) &&
        typeof config?.srcRoute === "string" &&
        config.srcRoute.startsWith("/[locale]"),
    )
    .sort(([left], [right]) => left.localeCompare(right));
  const templateRouteUsage = collectTemplateRouteFindings(
    localizedPageTemplates,
    localizedRoutes,
    configuredLocales,
  );
  const routeUsage = collectLocalizedRouteFindings({
    buildRoot,
    localizedRoutes,
  });

  return [
    ...templateRouteUsage,
    ...routeUsage,
    ...collectMetadataFindings(buildRoot, metadataLocale, expectedOgImageUrl),
  ];
}

function runPrerenderStaticCheck() {
  const findings = collectPrerenderStaticFindings();
  if (findings.length === 0) {
    console.log("prerender-static: passed");
    return true;
  }

  console.error("prerender-static: failed");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.error}`);
  }
  return false;
}

if (require.main === module) {
  if (!runPrerenderStaticCheck()) process.exitCode = 1;
}

module.exports = {
  collectPrerenderStaticFindings,
  runPrerenderStaticCheck,
};
