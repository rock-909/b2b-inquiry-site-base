/**
 * Lighthouse CI 配置 - 性能监控（替代 size-limit）
 *
 * 迁移说明：
 * Next.js 16 官方移除了构建输出中的 size/First Load JS 指标，
 * 因为在 RSC 架构下这些指标不准确。官方推荐使用 Lighthouse 测量真实性能。
 *
 * 监控策略：
 * 1. Core Web Vitals (LCP, FCP, CLS, TBT)
 * 2. Bundle 大小监控 (total-byte-weight, bootup-time)
 * 3. 未使用 JavaScript 检测 (unused-javascript)
 *
 * 阈值来源：下方各阈值旁记录的实测区间来源待核——本仓没有产生这些数值的
 * CI 作业，Lighthouse 现在只是手动性能证明。阈值数值本身未在此处重新测量。
 *
 * Budget governance:
 * - 继续保留全局 total-byte-weight warning，作为当前黄债信号。
 * - 旧 route-class target 已退役。
 * - route-class 目标升成硬断言前，必须先用多次 16 页 fresh sweep 证明不会制造
 *   false red。
 */

// 关键 URL 优先策略：全量覆盖任务运行全部 URL，否则仅运行首页。
// Lighthouse 是手动性能证明，不接入默认 CI 或 git hook。
const isFullCoverage = process.env.CI_FULL_COVERAGE === "true";

// 本站 localePrefix 为 'as-needed'（src/config/paths/locales-config.ts），正式 URL
// 不带 locale 段：`/en/x` 会 302 到 `/x`。直接请求无前缀地址，才不会把每一页都
// 变成一次重定向测量。owner 确认后续加语种时，再按当时的前缀策略调整。

// Deliberately not 3000. That port is shared by `pnpm dev`, `pnpm start`, the
// Playwright webServer (which adopts whatever is already listening), and every
// other worktree on this machine. `next start` cannot fall back to another port
// in production — start-server.js gates the EADDRINUSE retry on isDev and
// otherwise exits — while lhci only prints a warning when its own server fails
// to start and then measures whatever else answers (collect.js:171). Together
// that silently measures a foreign server and reports it as this site.
// A fixed port cannot be made collision-proof by binding tricks. `localhost`
// resolves to both ::1 and 127.0.0.1, so a foreign IPv4 listener can coexist
// with ours and answer some clients — verified by hand. Pinning the server to
// `--hostname 127.0.0.1` would close that, but it breaks the site: middleware
// rewrites still carry `localhost`, Next then treats the rewrite as
// cross-origin, downgrades it to a redirect, and every route 307s to itself
// forever. So the guard is a preflight check in `website:lighthouse` instead —
// if anything already holds this port, the command refuses to run.
const LIGHTHOUSE_PORT = 4173;
const BASE_URL = `http://localhost:${LIGHTHOUSE_PORT}`;

const criticalUrls = [`${BASE_URL}/`];

// Every canonical public route the template actually ships.
// tests/unit/scripts/lighthouse-route-contract.test.ts keeps this list matched
// to the static page registry, so a new route cannot quietly go unmeasured.
const allUrls = [
  ...criticalUrls,
  `${BASE_URL}/products`,
  `${BASE_URL}/about`,
  `${BASE_URL}/contact`,
  `${BASE_URL}/privacy`,
  `${BASE_URL}/terms`,
];

const sharedLighthouseAssertions = {
  // 此前记录称 /en 首页在 GitHub runner 上落在 0.75~0.79 区间（来源待核，
  // 本仓没有产生该数值的 CI 作业）；0.82 会把运行环境抖动误判成产品回归。
  // 暂时把硬门槛放到 0.78，继续保留 LCP / TBT / 字节预算等细项约束。
  // 这不是最终目标值，后续性能收口后仍应重新抬回 0.82+。
  "categories:performance": [
    "error",
    { minScore: 0.78, aggregationMethod: "median" },
  ],
  "categories:accessibility": ["error", { minScore: 0.9 }],
  "categories:best-practices": ["error", { minScore: 0.9 }],
  "first-contentful-paint": ["error", { maxNumericValue: 2000 }],
  // LCP ≤4500ms（记录的实测区间 2429-4331ms，来源待核）
  "largest-contentful-paint": ["error", { maxNumericValue: 4500 }],
  // CLS ≤0.15（记录的实测接近 0，来源待核；符合 Good CWV 标准，可考虑收紧）
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.15 }],
  // 此前记录称 GitHub runner 下 /en 页 best-run TBT 为 259.5ms / 341ms
  // （来源待核，本仓没有产生该数值的 CI 作业）。
  // 250ms 继续作为硬门槛会把运行环境抖动放大成系统性红灯。
  // 暂时放宽到 350ms，仍明显低于真正的坏值（>500ms），
  // 并继续使用 median 聚合降低冷启动噪声。
  "total-blocking-time": [
    "error",
    { maxNumericValue: 350, aggregationMethod: "median" },
  ],
  "speed-index": ["error", { maxNumericValue: 3000 }],
  // 'first-meaningful-paint' 已废弃，Lighthouse 不再产出该数值，移除以避免 NaN 断言
  // 冷启动下TTI波动较大，允许最高6s，优化后可再收紧
  interactive: ["error", { maxNumericValue: 6000 }],

  // ==================== Bundle 大小监控（替代 size-limit）====================
  // 总传输大小 490KB。
  // 这条继续作为全局 yellow-debt 信号；旧 route-class target 已退役，
  // 需要时按性能记录重建，暂不升成硬失败。
  "total-byte-weight": ["warn", { maxNumericValue: 490000 }],

  // JavaScript 启动时间：4s 阈值（解析、编译、执行时间）
  "bootup-time": ["warn", { maxNumericValue: 4000 }],

  // 未使用的 JavaScript：150KB 警告阈值（帮助识别 tree-shaking 问题）
  "unused-javascript": ["warn", { maxNumericValue: 153600 }],

  // 主线程工作时间：4s 阈值
  "mainthread-work-breakdown": ["warn", { maxNumericValue: 4000 }],
};

const indexablePageAssertions = {
  ...sharedLighthouseAssertions,
  "categories:seo": ["error", { minScore: 0.9 }],
};

module.exports = {
  ci: {
    collect: {
      url: isFullCoverage ? allUrls : criticalUrls,
      // APP_ENV=production is required, not cosmetic: without it every SEO
      // assertion fails on measurement setup rather than on real page quality.
      // It has to be set on BOTH the build and the server, and the build is the
      // one that actually decides. src/app/robots.ts emits `Disallow: /` for
      // any non-production build, and that file is generated at build time, so
      // a production server cannot undo it — every route fails `is-crawlable`
      // even though dynamic pages report `index, follow` in their own HTML.
      // Static pages additionally bake `noindex` into their markup
      // (src/lib/seo-metadata.ts:125). Leaving that to
      // whoever runs the command did not work — `pnpm website:check` ends in a
      // bare `pnpm build`, and measuring on top of that leftover scored 9
      // routes at 0.69 with `is-crawlable: Page is blocked from indexing`.
      // `website:lighthouse` therefore builds what it measures, into its own
      // `.next-lighthouse` tree, so a concurrent build or E2E sweep cannot
      // swap the artifact out from under a 20-minute measurement.
      startServerCommand:
        "NEXT_DIST_DIR=.next-lighthouse APP_ENV=production pnpm start " +
        `--port ${LIGHTHOUSE_PORT}`,
      startServerReadyPattern: "Local:",
      startServerReadyTimeout: 60000,
      // 使用 3 次运行配合 median 聚合，更好地过滤冷启动噪声
      numberOfRuns: 3,
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: ".*",
          assertions: indexablePageAssertions,
        },
      ],
    },
    upload: {
      target: "filesystem",
      outputDir: "reports/lighthouse",
    },
  },
};
