/**
 * 用已安装的 OpenNext stable 真实加载配置，并验证最终 R2 接线。
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const rootDir = process.argv[2];
if (!rootDir) {
  console.error("usage: node cloudflare-config-open-next-runner.mjs <rootDir>");
  process.exit(2);
}

const MISSING_LABEL = "incrementalCache: r2IncrementalCache";

function emit(result) {
  process.stdout.write(JSON.stringify(result));
}

try {
  const configModule = await import(
    pathToFileURL(path.join(rootDir, "open-next.config.ts")).href
  );
  const missing = [];
  const config = configModule.default;
  const defaultOverride = config?.default?.override;
  const middlewareOverride = config?.middleware?.override;
  const defaultCacheFactory = defaultOverride?.incrementalCache;
  const middlewareCacheFactory = middlewareOverride?.incrementalCache;

  if (
    typeof defaultCacheFactory !== "function" ||
    defaultCacheFactory() !== r2IncrementalCache ||
    typeof middlewareCacheFactory !== "function" ||
    middlewareCacheFactory() !== r2IncrementalCache
  ) {
    missing.push(MISSING_LABEL);
  }

  if (
    defaultOverride?.wrapper !== "cloudflare-node" ||
    defaultOverride?.converter !== "edge" ||
    defaultOverride?.proxyExternalRequest !== "fetch" ||
    defaultOverride?.tagCache !== "dummy" ||
    defaultOverride?.queue !== "dummy" ||
    defaultOverride?.cdnInvalidation !== "dummy" ||
    config?.default?.routePreloadingBehavior !== "none" ||
    config?.cloudflare?.useWorkerdCondition !== true ||
    config?.dangerous?.enableCacheInterception !== false ||
    config?.middleware?.external !== true ||
    middlewareOverride?.wrapper !== "cloudflare-edge" ||
    middlewareOverride?.converter !== "edge" ||
    middlewareOverride?.proxyExternalRequest !== "fetch" ||
    middlewareOverride?.tagCache !== "dummy" ||
    middlewareOverride?.queue !== "dummy"
  ) {
    missing.push("only the approved R2 incremental cache override is allowed");
  }

  emit({ ok: missing.length === 0, missing, forbidden: [] });
} catch (error) {
  // harness 内部任何异常都意味着 wiring 未被证明——同样携带核心标签。
  emit({
    ok: false,
    missing: [
      MISSING_LABEL,
      `open-next.config.ts failed to load with the installed OpenNext package: ${String(error)}`,
    ],
    forbidden: [],
  });
}
