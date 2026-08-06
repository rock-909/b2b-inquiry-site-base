import { resolve } from "path";
import { defineConfig } from "vitest/config";

const debugTestOutput = process.env.VITEST_DEBUG_OUTPUT === "true";

export default defineConfig({
  test: {
    // 测试环境配置 - 使用标准 jsdom 环境
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000",
        pretendToBeVisual: true,
        resources: "usable",
        runScripts: "dangerously",
      },
    },

    // 全局设置
    globals: true,

    // 设置文件
    setupFiles: ["./src/test/setup.ts"],

    // 测试文件匹配模式 - 优化分离策略
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
      "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
      "tests/architecture/**/*.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
      "tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
      "tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
    ],

    // 排除文件 - 严格分离浏览器测试
    exclude: [
      "node_modules",
      ".next",
      ".next-lighthouse",
      "dist",
      "build",
      "coverage",
      "**/*.d.ts",
      "**/*.stories.{js,jsx,ts,tsx}",
      // 排除setup文件和工具文件
      "**/setup.{js,jsx,ts,tsx}",
      "**/test-utils.{js,jsx,ts,tsx}",
      "**/__tests__/**/setup.{js,jsx,ts,tsx}",
      "**/__tests__/**/test-utils.{js,jsx,ts,tsx}",
      // 排除Mock文件 - 这些是Mock模块，不是测试文件
      "**/__tests__/**/mocks/**/*.{js,jsx,ts,tsx}",
      "**/mocks/**/*.{js,jsx,ts,tsx}",
      // 严格排除浏览器测试文件
      "**/*.browser.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
      "tests/browser/**/*",
      "tests/e2e/**/*",
      // 排除性能测试文件
      "**/*.performance.{test,spec}.{js,jsx,ts,tsx,mts,cts}",
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
        "**/*.stories.{js,jsx,ts,tsx}",
        "**/*.test.{js,jsx,ts,tsx}",
        "**/*.spec.{js,jsx,ts,tsx}",
        "src/test/**",
        "**/__mocks__/**",
        "**/test-utils/**",
        "src/middleware.ts",
        // 排除自动生成的文件
        "**/*.generated.*",
        // 排除纯类型定义文件（无运行时代码）
        "src/types/**/*.d.ts",
        // 注意：src/types/index.ts, test-types.ts, react19.ts 包含运行时函数，不排除
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
    isolate: true,

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

    // UI配置 - 默认关闭以避免端口监听需求
    ui: false,
    open: false,
  },

  // 路径别名配置 - 统一使用单一别名符合规则要求
  resolve: {
    alias: [
      // Stub CSS imports to avoid PostCSS processing in tests (must come before @ alias)
      {
        find: "@/app/globals.css",
        replacement: resolve(import.meta.dirname, "./src/test/css-stub.ts"),
      },
      // Fix directory import resolution in Vitest for packages that import "next/font/local"
      { find: "next/font/local", replacement: "next/font/local/index.js" },
      // Content path alias (must match tsconfig.json paths for consistency)
      {
        find: "@content",
        replacement: resolve(import.meta.dirname, "./content"),
      },
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
    "global.window": "globalThis",
    "typeof window": '"object"',
    __DEV__: true,
    __EXPERIMENTAL__: true,
    // React 19 兼容性：在模块加载前预设全局变量
    "globalThis.IS_REACT_ACT_ENVIRONMENT": "true",
    // 确保 React DOM 能够正确初始化
    "globalThis.window": "globalThis",
  },
});
