const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const { locales: CONFIGURED_LOCALES } = require("../../../i18n-locales.config");
const DEFAULT_BUILD_DIR = ".next";

const REQUEST_QUOTE_DYNAMIC_REASON =
  "server-validated search-param rendering on Request Quote";

function buildDynamicRouteExemptions(configuredLocales) {
  return new Map(
    configuredLocales.map((locale) => [
      `/${locale}/request-quote`,
      REQUEST_QUOTE_DYNAMIC_REASON,
    ]),
  );
}

const DYNAMIC_ROUTE_EXEMPTIONS =
  buildDynamicRouteExemptions(CONFIGURED_LOCALES);

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

function collectTemplateFindings(buildRoot, localizedPageTemplates) {
  const findings = [];
  for (const route of localizedPageTemplates) {
    const metaRelativePath = getMetaRelativePath(route);
    const metaPath = path.join(buildRoot, metaRelativePath);
    if (!fs.existsSync(metaPath)) {
      findings.push({
        file: metaRelativePath,
        error: `localized route template has no prerender shell "${route}"`,
      });
      continue;
    }
    if (!isPrerenderedMeta(readJson(metaPath))) {
      findings.push({
        file: metaRelativePath,
        error: `localized route template is not marked prerendered "${route}"`,
      });
    }
  }
  return findings;
}

function routeUsesLocale(route, locale) {
  return route === `/${locale}` || route.startsWith(`/${locale}/`);
}

function collectTemplateRouteFindings(
  localizedPageTemplates,
  localizedRoutes,
  configuredLocales,
  dynamicRouteExemptions,
) {
  const findings = [];
  const usedExemptions = new Set();
  for (const locale of configuredLocales) {
    const prerenderedTemplates = new Set(
      localizedRoutes
        .filter(([route]) => routeUsesLocale(route, locale))
        .map(([, config]) => config.srcRoute),
    );
    for (const route of localizedPageTemplates) {
      if (prerenderedTemplates.has(route)) continue;
      const localizedRoute = route.replace("[locale]", locale);
      if (dynamicRouteExemptions.has(localizedRoute)) {
        usedExemptions.add(localizedRoute);
        continue;
      }
      findings.push({
        file: "prerender-manifest.json",
        error: `localized route template has no prerender output for locale "${locale}" "${route}"`,
      });
    }
  }
  return { findings, usedExemptions };
}

function collectLocalizedRouteFindings({
  buildRoot,
  localizedRoutes,
  dynamicRouteExemptions,
}) {
  const findings = [];
  const usedExemptions = new Set();
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
    if (dynamicRouteExemptions.has(route)) usedExemptions.add(route);
    else {
      findings.push({
        file: metaRelativePath,
        error: `localized route unexpectedly keeps postponed rendering "${route}"`,
      });
    }
  }
  return { findings, usedExemptions };
}

function collectStaleExemptionFindings(dynamicRouteExemptions, usedExemptions) {
  return [...dynamicRouteExemptions]
    .filter(([route]) => !usedExemptions.has(route))
    .map(([route, reason]) => ({
      file: "scripts/quality/checks/prerender-static.js",
      error: `stale dynamic-route exemption "${route}": ${reason}`,
    }));
}

/**
 * @param {{
 *   rootDir?: string,
 *   buildDir?: string,
 *   configuredLocales?: string[],
 *   dynamicRouteExemptions?: Map<string, string>,
 * }=} options
 */
function collectPrerenderStaticFindings({
  rootDir = ROOT,
  buildDir = DEFAULT_BUILD_DIR,
  configuredLocales = CONFIGURED_LOCALES,
  dynamicRouteExemptions,
} = {}) {
  const effectiveDynamicRouteExemptions =
    dynamicRouteExemptions ?? buildDynamicRouteExemptions(configuredLocales);
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
  const hasTemplateShells = localizedPageTemplates.some((route) =>
    fs.existsSync(path.join(buildRoot, getMetaRelativePath(route))),
  );
  const templateRouteUsage = collectTemplateRouteFindings(
    localizedPageTemplates,
    localizedRoutes,
    configuredLocales,
    effectiveDynamicRouteExemptions,
  );
  const routeUsage = collectLocalizedRouteFindings({
    buildRoot,
    localizedRoutes,
    dynamicRouteExemptions: effectiveDynamicRouteExemptions,
  });
  const usedExemptions = new Set([
    ...templateRouteUsage.usedExemptions,
    ...routeUsage.usedExemptions,
  ]);

  return [
    // Template shells only exist with Cache Components on, which this runtime
    // keeps off, so this collector currently sits out every real build. The
    // routes it would cover are still checked through prerender-manifest by
    // the two collectors below. runPrerenderStaticCheck reports the skip so
    // "passed" cannot be read as "all three collectors ran".
    ...(hasTemplateShells
      ? collectTemplateFindings(buildRoot, localizedPageTemplates)
      : []),
    ...templateRouteUsage.findings,
    ...routeUsage.findings,
    ...collectStaleExemptionFindings(
      effectiveDynamicRouteExemptions,
      usedExemptions,
    ),
  ];
}

function describePrerenderStaticCoverage(
  rootDir = ROOT,
  buildDir = DEFAULT_BUILD_DIR,
) {
  const buildRoot = path.join(rootDir, buildDir);
  const appPathsPath = path.join(buildRoot, "server/app-paths-manifest.json");
  if (!fs.existsSync(appPathsPath)) return "";

  const templates = Object.keys(readJson(appPathsPath)).filter(
    (route) => route.startsWith("/[locale]") && route.endsWith("/page"),
  );
  const shells = templates.filter((route) =>
    fs.existsSync(
      path.join(
        buildRoot,
        getMetaRelativePath(route.slice(0, -"/page".length)),
      ),
    ),
  );

  return ` (${templates.length} localized template(s); template shells ${
    shells.length > 0
      ? `checked: ${shells.length}`
      : "not emitted, shell check skipped"
  })`;
}

function runPrerenderStaticCheck() {
  const findings = collectPrerenderStaticFindings();
  if (findings.length === 0) {
    console.log(`prerender-static: passed${describePrerenderStaticCoverage()}`);
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
  DYNAMIC_ROUTE_EXEMPTIONS,
  collectPrerenderStaticFindings,
  runPrerenderStaticCheck,
};
