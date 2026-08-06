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

module.exports = { verifyCloudflareArtifactConfig };

if (require.main === module) {
  try {
    const artifactPaths = verifyCloudflareArtifactConfig();
    console.log(
      `Verified canonical Cloudflare config in ${artifactPaths.length} artifact(s)`,
    );
  } catch (error) {
    console.error("Cloudflare artifact config check failed");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
