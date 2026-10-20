const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

// The canonical Cloudflare production artifact must ship non-sourcemapped,
// unoptimized-image config in both the Next and OpenNext required-server-files.
const ARTIFACT_PATTERNS = [
  ".next/**/required-server-files.json",
  ".open-next/**/.next/required-server-files.json",
];

function verifyCloudflareArtifactConfig(rootDir = ROOT) {
  const artifactPaths = ARTIFACT_PATTERNS.flatMap((pattern) => {
    const matches = fs.globSync(pattern, { cwd: rootDir }).sort();
    if (matches.length === 0) {
      throw new Error(`Missing required-server-files artifact: ${pattern}`);
    }
    return matches;
  });

  for (const artifactPath of artifactPaths) {
    const { config } = JSON.parse(
      fs.readFileSync(path.join(rootDir, artifactPath), "utf8"),
    );
    if (config.productionBrowserSourceMaps !== false) {
      throw new Error(
        `${artifactPath}: productionBrowserSourceMaps must be false`,
      );
    }
    if (config.images?.unoptimized !== true) {
      throw new Error(`${artifactPath}: images.unoptimized must be true`);
    }
  }

  return artifactPaths;
}

// 只读 Static Assets 缓存：populateCache 把 .open-next/cache 复制到这里。
// 漏填充时 build、dry-run 和 smoke 都能通过，Worker 却会记录只读缓存写入错误。
const BUILD_CACHE_DIR = ".open-next/cache";
const STATIC_ASSETS_CACHE_DIR = ".open-next/assets/cdn-cgi/_next_cache";

function verifyStaticAssetsCachePopulated(rootDir = ROOT) {
  const source = path.join(rootDir, BUILD_CACHE_DIR);
  const target = path.join(rootDir, STATIC_ASSETS_CACHE_DIR);
  const entries = fs.existsSync(source)
    ? fs
        .readdirSync(source, { recursive: true })
        .filter((entry) => fs.statSync(path.join(source, entry)).isFile())
    : [];
  if (entries.length === 0) {
    throw new Error(`No prerendered cache entries in ${BUILD_CACHE_DIR}`);
  }
  // 缺失、不是普通文件、内容与源不同，都会让 Worker 读缓存未命中。
  const missing = entries.filter((entry) => {
    const copy = path.join(target, entry);
    try {
      return (
        !fs.statSync(copy).isFile() ||
        !fs.readFileSync(copy).equals(fs.readFileSync(path.join(source, entry)))
      );
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    throw new Error(
      `${STATIC_ASSETS_CACHE_DIR} is missing ${missing.length} of ${entries.length} prerendered cache entries (absent, not a regular file, or different from ${BUILD_CACHE_DIR}; run opennextjs-cloudflare populateCache): ${missing[0]}`,
    );
  }
  return entries;
}

// OpenNext 把本地 .env* 文件的值写进 next-env.mjs，随 Worker 一起上传，Cloudflare
// 账号成员都能下载。公开的 NEXT_PUBLIC_* 本来就内联进页面，其余键一律拒绝上传。
function findBundledPrivateEnvKeys(rootDir = ROOT) {
  const filePath = path.join(
    rootDir,
    ".open-next",
    "cloudflare",
    "next-env.mjs",
  );
  if (!fs.existsSync(filePath)) return [];
  const source = fs.readFileSync(filePath, "utf8");
  const keys = [...source.matchAll(/^export const \w+ = (.*);$/gmu)].flatMap(
    ([, json]) => Object.keys(JSON.parse(json)),
  );
  return [
    ...new Set(keys.filter((key) => !key.startsWith("NEXT_PUBLIC_"))),
  ].sort();
}

module.exports = {
  findBundledPrivateEnvKeys,
  verifyCloudflareArtifactConfig,
  verifyStaticAssetsCachePopulated,
};

if (require.main === module) {
  const checkCache = process.argv.includes("--static-assets-cache");
  try {
    if (process.argv.includes("--private-env")) {
      const keys = findBundledPrivateEnvKeys();
      if (keys.length > 0) {
        throw new Error(
          `local .env files put non-public keys into the Worker bundle (${keys.join(", ")}); move them aside or deploy from a clean checkout`,
        );
      }
      console.log("Worker bundle carries no non-public env file values");
    } else if (checkCache) {
      const entries = verifyStaticAssetsCachePopulated();
      console.log(
        `Verified ${entries.length} prerendered cache entries in Static Assets`,
      );
    } else {
      const artifactPaths = verifyCloudflareArtifactConfig();
      console.log(
        `Verified canonical Cloudflare config in ${artifactPaths.length} artifact(s)`,
      );
    }
  } catch (error) {
    console.error("Cloudflare artifact config check failed");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
