import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});

// This lower-layer flag does not control the shipped Cloudflare worker.
// Keep it disabled unless a build-and-preview change proves it safe.
cloudflareConfig.default.minify = false;

export default cloudflareConfig;
