import { resolve } from "path";
import { configDefaults, defineConfig } from "vitest/config";

const debugTestOutput = process.env.VITEST_DEBUG_OUTPUT === "true";

export default defineConfig({
  test: {
    // 全局设置
    globals: true,

    // Node 集成不继承浏览器/env 桩；两个项目仍由默认 pnpm test 一起执行。
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          environmentOptions: {
            jsdom: { url: "http://localhost:3000", pretendToBeVisual: true },
          },
          setupFiles: ["./src/test/setup.ts"],
          exclude: ["tests/integration/api/lead-pipeline-in-process.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "inquiry-integration",
          environment: "node",
          include: ["tests/integration/api/lead-pipeline-in-process.test.ts"],
          setupFiles: [
            "./src/test/setup.console.ts",
            "./tests/integration/setup.ts",
          ],
          restoreMocks: true,
          unstubEnvs: true,
          unstubGlobals: true,
        },
      },
    ],

    // 使用 Vitest 默认 test/spec discovery，只排除非 Vitest 输入。
    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
      "**/{fixtures,__fixtures__}/**",
      "**/setup.{js,jsx,ts,tsx}",
      "**/test-utils.{js,jsx,ts,tsx}",
    ],

    // 覆盖率配置 - 最简配置
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      // 将覆盖率输出目录统一至 reports/coverage，便于与其它报告汇总
      reportsDirectory: "./reports/coverage",
      reporter: ["text", "html", "json-summary"],
      // Vitest v4: coverage.exclude only filters files already matched by
      // `include` (src/**); coverage.all was removed, so non-src globs never
      // match. Keep only src-relevant excludes.
      exclude: [
        "**/*.d.ts",
        "**/*.test.{js,jsx,ts,tsx}",
        "**/*.spec.{js,jsx,ts,tsx}",
        "src/test/**",
        "src/proxy.ts",
        // 排除自动生成的文件
        "**/*.generated.*",
      ],
      // 覆盖率为报告用途，不设阈值门禁；质量门禁是 type-check / lint / test / 架构测试
    },

    // 测试超时设置 - 适应 CI 环境
    testTimeout: 12000, // 从 8000ms 增加到 12000ms，适应 CI 环境资源限制
    hookTimeout: 6000, // 从 4000ms 增加到 6000ms

    // 并发设置 - 优化 CI 环境性能
    pool: "threads",

    // 添加测试重试机制 - 仅用于已知 flaky 测试，应在具体测试上使用 test.retry()
    // retry: 2, // 已移除全局 retry，遇到 flaky 测试应修复根因或局部声明

    // 报告器配置
    reporters: debugTestOutput ? ["verbose"] : ["default"],

    // 环境变量
    env: {
      NODE_ENV: "test",
    },

    // 性能配置 - 增强缓存和性能监控
    logHeapUsage: debugTestOutput,

    // 依赖优化 - 提高模块解析性能
    deps: {
      optimizer: {
        client: {
          enabled: true, // 启用Web依赖优化
        },
        ssr: {
          enabled: true, // 启用SSR依赖优化
        },
      },
    },

    // 不自动打开浏览器（Vitest 默认会打开）
    open: false,
  },

  // 路径别名配置 - 统一使用单一别名符合规则要求
  resolve: {
    alias: [
      // Main path aliases
      {
        find: "@messages",
        replacement: resolve(import.meta.dirname, "./messages"),
      },
      { find: "@", replacement: resolve(import.meta.dirname, "./src") },
    ],
  },

  // 定义全局变量 - React 19 兼容性增强
  define: {
    "process.env.NODE_ENV": '"test"',
    // React 19 并发特性支持
    // React 19 兼容性：在模块加载前预设全局变量
    "globalThis.IS_REACT_ACT_ENVIRONMENT": "true",
    // 确保 React DOM 能够正确初始化
  },
});
