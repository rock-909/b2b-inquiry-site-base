import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 只读 Static Assets 缓存：站点只提供构建期预渲染数据，内容更新走重新构建和部署。
const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});

export default cloudflareConfig;
