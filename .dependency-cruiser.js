// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");

module.exports = {
  forbidden: [
    // 层边界规则。
    {
      name: "no-lib-to-components-or-app",
      severity: "error",
      comment:
        "src/lib 不能依赖 src/components 或 src/app — lib 层必须独立于 UI 层",
      from: { path: "^src/lib/" },
      to: { path: "^src/(app|components)/" },
    },
    {
      name: "no-components-to-app",
      severity: "error",
      comment:
        "src/components 不能依赖 src/app — components 层不能反向依赖 app 层",
      from: { path: "^src/components/" },
      to: { path: "^src/app/" },
    },
    {
      name: "no-config-to-components",
      severity: "error",
      comment: "src/config 不能依赖 src/components — config 层必须与 UI 层解耦",
      from: { path: "^src/config/" },
      to: { path: "^src/components/" },
    },
    {
      name: "no-cross-route-import",
      severity: "error",
      comment: "不同路由目录不能直接导入彼此 — 共享逻辑应抽到 src/lib",
      from: { path: "^src/app/\\[locale\\]/([^/]+)/" },
      to: {
        path: "^src/app/\\[locale\\]/[^/]+/",
        pathNot: "^src/app/\\[locale\\]/$1/",
      },
    },
    {
      name: "no-non-test-imports-api-routes",
      severity: "error",
      comment:
        "非测试文件不能直接导入 API 路由实现 — 使用 fetch 或 server actions 代替",
      from: {
        path: "^src/",
        pathNot:
          "\\.(spec|test|stories)\\.(js|ts|tsx)$|/__tests__/|^src/app/api/",
      },
      to: { path: "^src/app/api/" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "禁止循环依赖 - 防止模块间相互引用导致的架构问题",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-test-imports-in-production",
      severity: "error",
      comment: "禁止生产代码导入测试文件",
      from: {
        pathNot: "\\.(spec|test|stories)\\.(js|ts|tsx)$",
      },
      to: {
        path: "\\.(spec|test|stories)\\.(js|ts|tsx)$",
      },
    },
    {
      name: "no-test-support-imports-in-production",
      severity: "error",
      comment: "禁止生产代码导入 src/test、src/testing 或 test-* 常量",
      from: {
        path: "^src/(app|components|config|hooks|i18n|lib|services)/",
        pathNot: "\\.(spec|test|stories)\\.(js|ts|tsx)$|/__tests__/",
      },
      to: {
        path: "^src/(test|testing)/|^src/constants/test-",
      },
    },
    {
      name: "no-dev-dependencies-in-production",
      severity: "error",
      comment: "禁止生产代码导入开发依赖",
      from: {
        path: "^src/",
        pathNot: "\\.(spec|test|stories)\\.(js|ts|tsx)$",
      },
      to: {
        dependencyTypes: ["npm-dev"],
      },
    },
    // === 跨域依赖规则（显式域匹配，避免跨规则反向引用） ===
    {
      name: "i18n-no-ui-deps",
      severity: "error",
      comment: "i18n 域不能依赖 UI 或页面层",
      from: {
        path: "^src/lib/i18n",
      },
      to: {
        path: "^src/(app|components)/",
        pathNot: "/(types|constants)\\.(ts|tsx)$",
      },
    },
    {
      name: "no-relative-cross-layer-imports",
      severity: "error",
      comment: "禁止相对路径跨层导入 - 必须使用@/别名",
      from: { path: "^src/" },
      to: {
        path: "\\.\\./",
        pathNot: "\\.(spec|test|stories)\\.(js|ts|tsx)$",
      },
    },
    {
      name: "i18n-domain-boundaries",
      severity: "error",
      comment: "i18n 域不能依赖其他业务 lib 子域",
      from: { path: "^src/lib/i18n/" },
      to: {
        path: "^src/lib/(?!i18n/)[^/]+/",
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: path.join(__dirname, "tsconfig.json"),
    },
    doNotFollow: {
      path: "node_modules|\\.(spec|test|stories)\\.(js|ts|tsx)$",
    },
    exclude: {
      path: "\\.(spec|test|stories)\\.(js|ts|tsx)$|node_modules",
    },
    tsPreCompilationDeps: true,
    preserveSymlinks: false,
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
        theme: {
          graph: {
            bgcolor: "transparent",
            splines: "ortho",
            rankdir: "TB",
            fontname: "Helvetica",
            fontsize: "9",
          },
          modules: [
            {
              criteria: { source: "^src/app" },
              attributes: { fillcolor: "#ffcccc", style: "filled" },
            },
            {
              criteria: { source: "^src/components" },
              attributes: { fillcolor: "#ccffcc", style: "filled" },
            },
            {
              criteria: { source: "^src/lib" },
              attributes: { fillcolor: "#ccccff", style: "filled" },
            },
          ],
        },
      },
    },
  },
};
