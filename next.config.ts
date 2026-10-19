import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { getSecurityHeaders } from "./src/config/security";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// middleware 在文件路由前运行；构建时记录真实文件，不能凭扩展名放行缺失资源。
const publicDirectory = join(__dirname, "public");
const publicAssetPaths = readdirSync(publicDirectory, {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name !== "_headers")
  .map(
    (entry) =>
      `/${relative(publicDirectory, join(entry.parentPath, entry.name)).split("/").map(encodeURIComponent).join("/")}`,
  );

const isCloudflare = process.env.DEPLOYMENT_PLATFORM === "cloudflare";
const nextConfig: NextConfig = {
  // Everything writes `.next` by default. `next start` reads this same config,
  // so setting NEXT_DIST_DIR on both build and start gives a command its own
  // output tree. Only `website:lighthouse` does that today: a measurement that
  // takes 20+ minutes must not race a build, an E2E sweep, or another agent
  // session rebuilding underneath it — see
  // docs/项目.md.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Expose only the non-secret deployment label so Client Components can
  // distinguish a production build from an actual production deployment.
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV ?? "local",
    PUBLIC_ASSET_PATHS: JSON.stringify(publicAssetPaths),
  },

  // Exclude test/report artifacts from OpenNext bundle
  outputFileTracingExcludes: {
    "/*": [
      "./reports/**",
      "./coverage/**",
      "./test-results/**",
      "./.lighthouseci/**",
      "./tests/e2e/.playwright/**",
      "./playwright-report/**",
      "./.playwright/**",
    ],
  },

  // Compile all eligible components and hooks; Turbopack runs the native Rust
  // transform selected below instead of the Babel/Node.js implementation.
  reactCompiler: true,

  // Turbopack 配置 - 明确指定项目根目录
  turbopack: {
    root: __dirname,
  },

  // Cloudflare deploy artifacts prioritize bundle size; disable browser source maps there.
  productionBrowserSourceMaps: !isCloudflare,

  images: {
    // Starter baseline: Cloudflare builds must not require Images,
    // Transformations, Polish, Mirage, R2, or a custom image loader. Derived
    // customer projects can opt into those lanes only with separate deployed
    // Cloudflare proof.
    ...(isCloudflare ? { unoptimized: true } : {}),
  },

  experimental: {
    turbopackRustReactCompiler: true,
    // Owner decision: use Next.js's agent feedback. `next dev` maintains its
    // managed block in AGENTS.md.
    agentFeedback: true,
    // Owner decision: nudge agents to upgrade only when the installed Next.js
    // has a published security advisory ('latest' would nag on every minor).
    agentUpgrade: "security",
    // 内联关键CSS（experimental.inlineCss）保持禁用：此前的记录称它在当前构建链路下
    // 会引入 FOUC 和首屏 CLS 劣化（本次未重新测量）。Lighthouse 是手动性能证明
    // （`pnpm website:lighthouse`），不是默认 CI 门禁；重新评估时请手动运行。
    inlineCss: false,
  },

  headers() {
    const securityHeaders = getSecurityHeaders();

    // CDN 缓存策略
    // 为静态资源设置长期缓存，提升性能和 LCP
    const cdnCacheHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    const nonProductionNoindexHeaders = [
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow",
      },
    ];
    const shouldNoindexPublicPages = process.env.APP_ENV !== "production";

    // 这些规则只对 Next 服务器渲染的响应生效：本地/CI 的 Node 服务器，以及
    // Worker 渲染的路由（含 src/app/icon.svg 这类文件式 metadata）。
    // public/ 下的文件由 Cloudflare Static Assets 直送，不经过这里——
    // 要给它们加响应头，必须同时写进 public/_headers。改这里的人请一起改那边。
    const headerConfigs = [
      // 安全头部应用到所有路径
      ...(securityHeaders.length > 0
        ? [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
          ]
        : []),
      ...(shouldNoindexPublicPages
        ? [
            {
              source: "/:path*",
              headers: nonProductionNoindexHeaders,
            },
          ]
        : []),
      // CDN 缓存策略应用到静态资源
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|pdf|woff|woff2|ttf|otf)",
        headers: cdnCacheHeaders,
      },
    ];

    return headerConfigs;
  },
};

export default withNextIntl(nextConfig);
