const fs = require("node:fs");
const path = require("node:path");

const HEADER_FILES = ["public/_headers", ".open-next/assets/_headers"];
const STATIC_ASSET_ROUTE = "/_next/static/*";
const REQUIRED_CACHE_DIRECTIVES = new Set([
  "public",
  "max-age=31536000",
  "immutable",
]);
const FORBIDDEN_CACHE_DIRECTIVES = [
  "no-store",
  "no-cache",
  "private",
  "s-maxage",
];

function parseHeaderBlocks(content) {
  const blocks = new Map();
  let currentRoute = undefined;

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (!/^\s/u.test(rawLine)) {
      currentRoute = line;
      if (!blocks.has(currentRoute)) blocks.set(currentRoute, new Map());
      continue;
    }

    if (!currentRoute) continue;
    const headers = blocks.get(currentRoute);
    if (line.startsWith("!")) {
      headers.set(`!${line.slice(1).trim().toLowerCase()}`, "true");
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const existing = headers.get(name);
    headers.set(name, existing ? `${existing}, ${value}` : value);
  }

  return blocks;
}

function readHeaderFile(rootDir, repoPath, failures) {
  const absolutePath = path.join(rootDir, repoPath);

  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    failures.push(
      `${repoPath} could not be read (${error.code ?? "unknown error"})`,
    );
    return undefined;
  }
}

function parseCacheDirectives(value) {
  return new Set(
    value
      .toLowerCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function hasRequiredCacheDirectives(directives) {
  return [...REQUIRED_CACHE_DIRECTIVES].every((directive) =>
    directives.has(directive),
  );
}

function getDirectiveName(directive) {
  return directive.split("=", 1)[0].trim();
}

function isStaticCacheRoute(route) {
  return route.includes("/_next/static");
}

function validateStaticCacheControl(repoPath, route, cacheControl, failures) {
  const directives = parseCacheDirectives(cacheControl);
  const directiveNames = new Set([...directives].map(getDirectiveName));
  const forbiddenDirective = FORBIDDEN_CACHE_DIRECTIVES.find((directive) =>
    directiveNames.has(directive),
  );

  if (forbiddenDirective) {
    failures.push(
      `${repoPath} ${route} must not include Cache-Control directive: ${forbiddenDirective}`,
    );
    return;
  }

  if (!hasRequiredCacheDirectives(directives)) {
    failures.push(
      `${repoPath} ${route} must keep Cache-Control directives: ${[
        ...REQUIRED_CACHE_DIRECTIVES,
      ].join(", ")}`,
    );
  }
}

function collectCloudflareStaticAssetHeaderFailures({
  rootDir = process.cwd(),
} = {}) {
  const failures = [];

  for (const repoPath of HEADER_FILES) {
    const content = readHeaderFile(rootDir, repoPath, failures);
    if (content === undefined) continue;

    const blocks = parseHeaderBlocks(content);
    const routeHeaders = blocks.get(STATIC_ASSET_ROUTE);
    const exactCacheControl = routeHeaders?.get("cache-control");

    if (!routeHeaders) {
      failures.push(`${repoPath} is missing ${STATIC_ASSET_ROUTE}`);
    } else if (!exactCacheControl && !routeHeaders.has("!cache-control")) {
      failures.push(
        `${repoPath} ${STATIC_ASSET_ROUTE} is missing Cache-Control`,
      );
    }

    for (const [route, headers] of blocks) {
      if (!isStaticCacheRoute(route)) continue;
      if (headers.has("!cache-control")) {
        failures.push(`${repoPath} ${route} must not unset Cache-Control`);
        continue;
      }
      const cacheControl = headers.get("cache-control");
      if (!cacheControl) continue;
      validateStaticCacheControl(repoPath, route, cacheControl, failures);
    }
  }

  return failures;
}

function runCloudflareStaticAssetHeaderCli(options = {}) {
  const failures = collectCloudflareStaticAssetHeaderFailures(options);

  if (failures.length > 0) {
    console.error("[cf-static-asset-headers] Failures detected:");
    for (const failure of failures) console.error(`  - ${failure}`);
    return false;
  }

  console.log("[cf-static-asset-headers] All checks passed");
  return true;
}

module.exports = {
  collectCloudflareStaticAssetHeaderFailures,
  runCloudflareStaticAssetHeaderCli,
};
