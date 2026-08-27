import { fixupConfigRules } from "@eslint/compat";
import js from "@eslint/js";
// Next.js ESLint configs - 使用官方推荐的直接导入方式
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import promisePlugin from "eslint-plugin-promise";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import securityPlugin from "eslint-plugin-security";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments/configs";

const security = securityPlugin.default ?? securityPlugin;
const promise = promisePlugin.default ?? promisePlugin;
// Common project literals are allowlisted to limit lint noise. Numbers
// outside this list still fail no-magic-numbers; add entries only for
// intentional production literals with a concrete use.
const MAGIC_NUMBER_IGNORE_LIST = [
  // 基础数字
  0, 1, -1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  // 常见小数字
  12, 14, 16, 18, 20, 22, 24, 25, 30, 32, 36, 40, 50,
  // 百分比相关
  60, 64, 90, 100,
  // 尺寸和像素
  120, 128, 150, 190, 250, 256, 300, 360,
  // 大数字和时间（含 365 = 天/年）
  365, 1000, 1024, 4000, 5000, 60000, 300000,
];

// 构建/配置/脚本工具的共享宽松规则与插件（R2-F04）。
// 这些条目在 config-and-dev-tools 与 scripts 两个 block 中逐字相同；
// 两个 block 各自的 scope-specific 差异（severity/选项/独有规则）仍留在各自 block 内。
const sharedToolingPlugins = {
  security,
  "react-you-might-not-need-an-effect": reactYouMightNotNeedAnEffect,
};

const sharedToolingRules = {
  // 配置和脚本使用更宽松的结构阈值。
  "max-lines-per-function": [
    "warn",
    { max: 250, skipBlankLines: true, skipComments: true },
  ],
  complexity: ["warn", 18],
  "max-lines": [
    "warn",
    { max: 800, skipBlankLines: true, skipComments: true },
  ],
  "max-params": ["warn", 5],
  "max-statements": ["warn", 35],
  "max-depth": ["warn", 4],
  "max-nested-callbacks": ["warn", 4],

  // 构建脚本必要豁免。
  "no-console": "off", // 构建脚本需要console输出
  "no-magic-numbers": "off", // 配置文件需要具体数值
  "no-implicit-coercion": "off", // 配置文件类型转换
  "no-plusplus": "off", // 脚本中允许++操作符
  "prefer-template": "warn", // 字符串拼接降级为警告
  "no-else-return": "warn", // else return降级为警告

  // TypeScript / Node.js 工具规则。
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-require-imports": "off",
  "no-undef": ["error", { typeof: true }], // 未定义变量检查
  "no-restricted-imports": "off",
  "react/no-unescaped-entities": "off", // 文案允许未转义实体
  "react-you-might-not-need-an-effect/no-event-handler": "warn",
  "react-you-might-not-need-an-effect/no-chain-state-updates": "warn",
  "no-void": "off", // 允许显式丢弃表达式结果
  "no-empty-function": "warn", // 工具占位符
};

// 具名再导出：这个文件现在也被 eslint 自己检查（它不再躺在忽略清单里），
// 匿名默认导出会触发 import/no-anonymous-default-export。
const eslintConfig = [
  {
    name: "ignores",
    ignores: [
      "performance-audit/**",
      "reports/**",
      ".next/**",
      ".next-lighthouse/**",
      ".trash-next-artifacts/**",
      ".context/**",
      ".stryker-tmp/**",
      "coverage/**",
      "dist/**",
      "build/**",
      ".codex/**",
      ".omx/**",
      ".eslintcache-audit",
      // Auto-generated files
      "src/lib/*.generated.ts",
    ],
  },
  // Base JavaScript configuration
  js.configs.recommended,

  // Next.js configuration - 直接 spread 官方配置 (避免 FlatCompat 循环引用问题)
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),

  // Import resolver settings for @/* alias (TypeScript + Node)
  {
    name: "import-resolver-settings",
    files: ["**/*.{js,jsx,ts,tsx}"],
    settings: {
      "import/resolver": {
        typescript: { project: ["./tsconfig.json"] },
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      },
    },
  },

  // React You Might Not Need An Effect - strict preset (all 10 rules as error)
  // Includes: no-empty-effect, no-adjust-state-on-prop-change, no-reset-all-state-on-prop-change,
  // no-event-handler, no-pass-live-state-to-parent, no-pass-data-to-parent, no-pass-ref-to-parent,
  // no-initialize-state, no-chain-state-updates, no-derived-state
  {
    name: "react-you-might-not-need-an-effect-config",
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...reactYouMightNotNeedAnEffect.configs.strict,
  },

  // Theme switcher exception for SSR hydration pattern
  {
    name: "theme-switcher-ssr-exception",
    files: ["**/theme-switcher.tsx"],
    plugins: {
      "react-you-might-not-need-an-effect": reactYouMightNotNeedAnEffect,
    },
    rules: {
      // next-themes 推荐的 SSR 水合模式需要在 useEffect 中初始化 mounted 状态
      "react-you-might-not-need-an-effect/no-initialize-state": "off",
    },
  },

  // React hooks call-ordering correctness 由 core-web-vitals preset 内置
  // （react-hooks/rules-of-hooks 已是 error），不再重复声明。
  // exhaustive-deps 在 project-overrides 中升级为 error。

  // Security configuration
  {
    name: "security-config",
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      security,
    },
    rules: {
      ...security.configs.recommended.rules,
      // 噪音过大且 TS 无法表达上下文：由 Semgrep（ERROR gate）承担代码级对象注入扫描
      "security/detect-object-injection": "off",
      "security/detect-non-literal-regexp": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-possible-timing-attacks": "error",
      "security/detect-pseudoRandomBytes": "error",
    },
  },

  // 安全模块加强规则（禁 any、需显式错误处理）
  {
    name: "security-hardened",
    files: ["src/lib/security/**/*.{ts,tsx}"],
    plugins: {
      promise,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-throw-literal": "error",
      "promise/always-return": "off",
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // 生产代码质量基线。
  {
    name: "production-quality",
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // 复杂度控制。
      complexity: ["error", 15],
      "max-depth": ["error", 3],
      "max-lines-per-function": [
        "error",
        { max: 120, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["error", 3],
      "max-nested-callbacks": ["error", 2],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-statements": ["error", 20],

      // 基础代码质量。
      "no-console": "error",
      "no-debugger": "error",
      "no-alert": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unreachable-loop": "error",

      "no-empty": "error",
      "no-empty-function": "error",
      "no-implicit-coercion": "error",
      "no-magic-numbers": [
        "error",
        {
          ignore: MAGIC_NUMBER_IGNORE_LIST,
          ignoreArrayIndexes: true, // 数组索引豁免
          ignoreDefaultValues: true, // 默认值豁免
          ignoreNumericLiteralTypes: true, // 类型域字面量豁免
          ignoreEnums: true, // 枚举值豁免
          ignoreReadonlyClassProperties: true, // 只读类属性豁免
          ignoreTypeIndexes: true, // 类型索引豁免
          enforceConst: true,
          detectObjects: false, // 关闭对象检测，减少噪音
        },
      ],

      // 通用正确性规则。
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-promise-reject-errors": "error",
      radix: "error",
      yoda: "error",

      // 安全相关。
      "no-new-wrappers": "error",
      "no-proto": "error",
      "no-return-assign": "error",
      "no-void": "error",
      "no-with": "error",
      "require-await": "error",

      // 代码形状。
      "array-callback-return": "error",
      "block-scoped-var": "error",
      "consistent-return": "error",
      "default-case": "error", // 升级为error - switch语句必须有default case
      "default-case-last": "error",
      "dot-notation": [
        "error",
        {
          allowKeywords: true,
          allowPattern: "^[a-zA-Z_$][a-zA-Z0-9_$]*$", // Allow flexible property access for better DX
        },
      ],
      "guard-for-in": "error",
      "no-caller": "error",
      "no-constructor-return": "error",
      "no-else-return": "error",
      "no-extend-native": "error",
      "no-extra-bind": "error",
      "no-implicit-globals": "error",
      "no-iterator": "error",
      "no-labels": "error",
      "no-lone-blocks": "error",
      "no-loop-func": "error",
      "no-multi-assign": "error",
      "no-new": "error",
      "no-object-constructor": "error",
      "no-octal-escape": "error",
      "no-param-reassign": "error",
      "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
      // architecture-boundaries 也设 no-restricted-syntax，但那块排除了
      // scripts、config、src/constants 等——在被它排除的文件上，这里这条是唯一
      // 生效的一条，删掉就是真放宽。本块自己的 guard-for-in 也不等价：它只要求
      // for-in 带原型守卫，不禁止 for-in 本身。
      "no-restricted-syntax": [
        "error",
        "ForInStatement",
        "LabeledStatement",
        "WithStatement",
      ],
      "no-shadow": "error",
      "no-ternary": "off", // 允许三元运算符，但要谨慎使用
      "no-underscore-dangle": "error",
      "no-unneeded-ternary": "error",
      "no-unused-private-class-members": "error",
      "prefer-arrow-callback": "error",
      "prefer-destructuring": [
        "error",
        {
          array: false, // 允许数组索引访问，如 arr[0]
          object: true, // 仍然要求对象解构
        },
      ],
      "prefer-exponentiation-operator": "error",
      "prefer-object-spread": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "prefer-template": "error",

      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // 🔴 全TypeScript项目：严格禁止any类型
      "@typescript-eslint/no-explicit-any": "error",
      // Note: no-unsafe-* rules require type information, handled by Next.js config

      // Note: Some TypeScript rules requiring type information are handled by Next.js config
    },
  },

  // TypeScript类型定义文件配置 - 豁免类型域中的字面量数字
  {
    name: "typescript-types-overrides",
    files: ["src/types/**/*.ts", "src/**/*.d.ts", "**/@types/**/*.ts"],
    rules: {
      // 类型定义中的字面量数字是必要的，不应被视为魔法数字
      "no-magic-numbers": "off", // 类型定义中的字面量类型
      // 类型定义中允许更多参数以表达完整签名
      "max-params": "off",
    },
  },

  // 常量定义文件配置 - 豁免魔法数字规则
  {
    name: "constants-files-overrides",
    files: ["src/constants/**/*.ts", "src/constants/**/*.js"],
    rules: {
      // 常量定义文件中的数字是有意义的常量，不应被视为魔法数字
      "no-magic-numbers": "off", // 常量定义文件豁免魔法数字检查
    },
  },

  // 配置和开发工具规则。
  {
    name: "config-and-dev-tools",
    files: [
      "config/**/*.{js,ts}",
      ".size-limit.js",
      "next.config.ts",
      "vitest.config.mts",
      "playwright.config.ts",
      "*.config.{js,ts,mjs}",

      // 开发者工具。
      "src/app/**/diagnostics/**/*.{ts,tsx}",
      "src/components/examples/ui-showcase/**/*.{ts,tsx}",
    ],
    plugins: { ...sharedToolingPlugins },
    rules: {
      ...sharedToolingRules,

      // 开发工具特定但合理的豁免。
      "@typescript-eslint/ban-ts-comment": "warn", // 开发工具允许@ts-nocheck（仅开发环境）
      "@typescript-eslint/no-unused-vars": [
        "error", // 开发工具也保持严格标准
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-underscore-dangle": ["error", { allow: ["__DEV__"] }],
      "security/detect-object-injection": "warn", // 开发工具动态访问，降级为警告
      "consistent-return": "warn", // 开发工具复杂逻辑
      "no-param-reassign": "warn", // 开发工具参数修改
      "prefer-destructuring": "warn", // 开发工具属性访问
      "no-unused-vars": "warn", // 清理未使用变量
      "security/detect-non-literal-fs-filename": "warn", // 文件系统操作降级为警告
      "security/detect-non-literal-regexp": "warn", // 动态正则表达式降级为警告
      radix: "warn", // parseInt缺少radix参数降级为警告
      "no-useless-escape": "warn", // 不必要的转义字符降级为警告
      "require-await": "warn", // async函数无await降级为警告
      "default-case": "warn", // switch缺少default降级为警告
    },
  },

  // 架构边界。
  {
    name: "architecture-boundaries",
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "scripts/**/*.{js,ts}",
      "config/**/*.{js,ts}",
      "*.config.{js,ts,mjs}",
      // 允许常量聚合入口使用 export * 模式（集中 re-export 常量）
      "src/constants/index.ts",
      // 测试文件豁免 - 允许相对路径导入
      "**/*.test.{js,jsx,ts,tsx}",
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
      "tests/**/*.{js,jsx,ts,tsx}",
      "src/test/**/*.{js,jsx,ts,tsx}",
      "src/testing/**/*.{js,jsx,ts,tsx}",
      "e2e/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      // 使用命名导出，避免新增不透明的 barrel 边界。
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            '🚫 禁止新增 export * 重新导出。请使用命名导出：export { specificExport } from "./module"',
        },
      ],

      // 禁止相对路径导入（强制使用@/别名）+ 禁止直接使用 next/link
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                '🚫 Use { Link } from "@/i18n/routing" for locale-aware navigation.',
            },
          ],
          patterns: [
            {
              group: ["../*"],
              message:
                '🚫 请使用 @/ 路径别名替代跨目录相对路径导入，例如：import { something } from "@/lib/module"',
            },
          ],
        },
      ],
    },
  },

  // 项目级覆盖。
  {
    name: "project-overrides",
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // React Hooks 依赖缺失会产生真实运行问题，因此升级为 error。
      "react-hooks/exhaustive-deps": "error",

      // 函数命名和结构
      "func-names": ["warn", "as-needed"], // 鼓励命名函数，便于调试
      "no-anonymous-default-export": "off", // 允许匿名默认导出（React组件）

      // 安全增强（eval / implied-eval / Function 构造函数的禁令在
      // production-quality，作用域与本块完全相同，不在这里重复设置）

      // 类型安全增强（仅适用于TypeScript文件）
      "@typescript-eslint/no-unused-expressions": "error", // 禁止未使用的表达式
      // 注意：prefer-nullish-coalescing 和 prefer-optional-chain 需要类型信息
      // 这些规则由 Next.js TypeScript 配置处理
    },
  },

  // eslint-disable discipline — require rule name + justification
  eslintComments.recommended,
  {
    name: "eslint-comments-strict",
    rules: {
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/disable-enable-pair": [
        "error",
        { allowWholeFile: true },
      ],
    },
  },

  // TypeScript files: disable base rules that duplicate TS-aware checks.
  {
    name: "ts-core-overrides",
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-expressions": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },

  // 🔧 Next.js配置文件特殊规则 - security.ts被next.config.ts使用，需要相对路径导入
  {
    name: "nextjs-config-files",
    files: ["src/config/security.ts"],
    rules: {
      "no-restricted-imports": "off", // Next.js配置编译时路径别名不可用
    },
  },

  // Next.js App Router page.tsx 导出守护 - 禁止非标准命名导出
  {
    name: "nextjs-page-export-guards",
    files: ["src/app/**/page.tsx", "src/app/**/page.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // 匹配所有不在白名单内的命名导出：
          // 允许函数：generateMetadata | generateStaticParams | generateViewport | generateImageMetadata
          // 允许配置常量：Next.js route segment config，包括 16.3 的 instant/prefetch
          selector:
            "ExportNamedDeclaration:not(:has(FunctionDeclaration[id.name=/^(generateMetadata|generateStaticParams|generateViewport|generateImageMetadata)$/])):not(:has(VariableDeclaration > VariableDeclarator[id.name=/^(revalidate|dynamic|dynamicParams|fetchCache|runtime|preferredRegion|maxDuration|instant|prefetch)$/])):not(:has(ExportSpecifier[exported.name=/^(revalidate|dynamic|dynamicParams|fetchCache|runtime|preferredRegion|maxDuration|instant|prefetch)$/]))",
          message:
            "🚫 app/**/page.tsx 仅允许导出 generateMetadata/generateStaticParams/generateViewport/generateImageMetadata 以及 Next.js 配置常量（revalidate、dynamic、dynamicParams、fetchCache、runtime、preferredRegion、maxDuration、instant、prefetch）。请将组件或其他导出移到单独文件。",
        },
      ],
    },
  },

  // 测试文件规则（合并了原 tests-relaxed / test-files / test-files-final-override 三层）。
  // 原第一层在 production-quality 之前声明、其 off 值全数被后续层覆盖，是死配置；
  // 现将最终生效值收敛为单一作用域层，jest 导入禁令等最终覆盖语义保持不变。
  {
    name: "test-files",
    files: [
      "**/*.test.{js,jsx,ts,tsx}",
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
      "tests/**/*.{js,jsx,ts,tsx}",
      "src/test/**/*.{js,jsx,ts,tsx}",
      "src/testing/**/*.{js,jsx,ts,tsx}",
      "e2e/**/*.{js,jsx,ts,tsx}",
      "scripts/__fixtures__/**/*.{js,jsx,ts,tsx}",
      "**/mocks/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      security,
    },
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        vitest: "readonly",
      },
    },
    rules: {
      // 测试结构仍受宽松阈值约束。
      "max-lines-per-function": [
        "warn",
        { max: 700, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["warn", 20],
      "max-nested-callbacks": ["warn", 6],
      "max-lines": [
        "warn",
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
      "max-statements": ["warn", 50],
      "max-params": ["warn", 8],
      "max-depth": ["warn", 5],

      // 测试文件必要的特殊模式。
      "no-magic-numbers": "off", // 测试数据需要具体数值
      "no-plusplus": "off", // 循环计数器在测试中常见
      "prefer-arrow-callback": "off", // function表达式在测试中更清晰
      "no-unused-expressions": "off", // expect().toBe() 断言语句
      "no-empty-function": "off", // 空 mock 函数是合理的
      "prefer-destructuring": "off", // 测试中直接属性访问更直观
      "no-new": "off", // mock 对象创建需要
      "require-await": "off", // async 测试模式
      "no-throw-literal": "off", // 测试异常抛出
      "no-underscore-dangle": "off", // 私有属性测试访问
      "@typescript-eslint/no-explicit-any": "off",
      // 基础 no-unused-vars 不在此设置：TS 文件由 @typescript-eslint/no-unused-vars
      // 接管（见 ts-core-overrides），JS 文件沿用 production-quality 的严格标准。
      "@typescript-eslint/no-require-imports": "off", // 测试中可能需要 require 导入
      "security/detect-unsafe-regex": "warn", // 测试正则表达式
      "no-script-url": "off", // 测试 URL 可能需要
      "no-shadow": "off", // Mock 变量重复声明是正常模式
      "no-console": ["warn", { allow: ["warn", "error", "info", "log"] }],
      "@next/next/no-img-element": "off", // 测试中允许使用原生 img 元素

      // 最终覆盖层的语义（原样并入本块）：
      // 测试文件可以用相对路径导入，但 jest API 仍然禁止：项目跑的是 Vitest。
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "jest", message: "项目使用 Vitest，禁止引入 jest.* API" },
            {
              name: "@jest/globals",
              message: "项目使用 Vitest，禁止引入 jest.* API",
            },
          ],
          patterns: [
            {
              group: ["@jest/*"],
              message: "项目使用 Vitest，禁止引入 jest.* API",
            },
          ],
        },
      ],
      "no-restricted-syntax": "off",
      // 安全规则在测试中完全忽略 - 测试文件中的动态对象访问是正常模式
      "security/detect-object-injection": "off",
      // 允许在测试中动态构建正则（常见于匹配断言）；保持为 warn 以提示潜在风险
      "security/detect-non-literal-regexp": "warn",

      // 测试文件中的 React/Next 特定放宽：
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-assign-module-variable": "off",

      // 一些在测试数据构造中常见但对生产代码不建议的模式
      "no-constant-binary-expression": "off",
    },
  },

  // 类型声明与第三方兼容性区域（types）
  {
    name: "types-compatibility-overrides",
    files: ["src/types/**/*.{ts,tsx}"],
    plugins: {
      security,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "max-depth": ["warn", 5],
      "security/detect-object-injection": "warn",
    },
  },

  // 构建和质量脚本规则。
  {
    name: "scripts",
    files: ["scripts/**/*.{js,ts,mjs}"],
    plugins: { ...sharedToolingPlugins },
    rules: {
      ...sharedToolingRules,

      // 脚本 block 独有豁免（比 config-and-dev-tools 更宽松）。
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-underscore-dangle": "off",
      "no-multi-assign": "off",
      "no-loop-func": "off",
      "no-shadow": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
      "consistent-return": "off",
      "no-useless-escape": "off",
      "no-param-reassign": "off",
      "prefer-destructuring": "off",
      radix: "off",
      "require-await": "off",
      "default-case": "off",
      "no-process-exit": "off",
    },
  },

  // 对当前较大的质量脚本使用文件级结构阈值。
  {
    name: "script-structural-baselines",
    files: ["scripts/quality/checks/release-verify.js"],
    rules: {
      complexity: ["warn", 30],
      "max-lines": [
        "warn",
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
      "max-statements": ["warn", 45],
    },
  },

  // Prettier configuration (must be last to override conflicting rules)
  prettierConfig,

  // Global ignores
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-lighthouse/**",
      ".trash-next-artifacts/**",
      "out/**",
      "build/**",
      "dist/**",
      ".conductor/**",
      "public/**",
      ".env*",
      "coverage/**",
      "*.d.ts",
      "reports/**",
      "backups/**", // 忽略备份文件，减少非目标代码噪声
      ".worktrees/**", // local dependency-lane worktrees and their generated build output
      "jest.setup.js",
      "jest.config.js",
      "tina/__generated__/**", // 忽略TinaCMS生成的文件
      ".dependency-cruiser.js", // 工具配置文件
      ".claude/skills/**", // agent skill 参考脚本，非生产代码
      ".claude/worktrees/**", // temporary git worktree state
      ".agent/**", // repo-local agent runtime assets
      ".agents/**", // repo-local agent skill assets
      ".continue/**", // local editor/agent workspace files
      ".factory/**", // local factory outputs
      ".kiro/**", // local IDE agent assets
      "skills/**", // local skill workspace
      "skills-lock.json", // local skill lockfile
      ".open-next/**", // OpenNext/Cloudflare 构建产物
      ".wrangler/**", // Wrangler 构建产物
    ],
  },
];

export default eslintConfig;
