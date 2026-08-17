# TypeScript 7 / TypeScript 6 双轨迁移

本文档记录项目为什么同时保留 TypeScript 7 CLI 和 TypeScript 6 工具链、需要关注
哪些上游变化，以及满足什么条件后可以迁移到单轨 TypeScript 7。代码、lockfile、实时
package peer range 和实际验证结果优先于本文档中的时间点快照。

本文档是 `docs/README.md` 中“不得长期维护版本快照”规则的受控例外。日期快照只解释
当前决定，不自动批准未来升级；触发重新检查时必须查询实时来源。

## 当前决定

项目暂时保留双轨：

- `@typescript/native` 提供 TypeScript 7 CLI，供项目 `type-check` 和
  `type-check:tests` 使用；
- `typescript` 指向 `@typescript/typescript6`，供 Next.js 的 JavaScript compiler
  API 路线、ESLint、Storybook 和其他构建工具使用；
- `next.config.ts` 保持 `experimental.useTypeScriptCli: false`，避免 Next.js 把
  `typescript` 包误当成 TS7 CLI；
- `tests/architecture/next-config-contract.test.ts` 锁住上述关系，防止依赖整理时误拆。

这不是运行时双版本，也不会进入浏览器或 Cloudflare Worker。它只影响开发、检查和
构建工具，因此当前代价主要是依赖管理复杂度，不是生产包体积或线上性能。

## 2026-08-05 状态快照

- 项目 CLI 为 TypeScript `7.0.2`；
- 工具链 `typescript` 为 `@typescript/typescript6@6.0.2`；
- Next.js 16.3 已支持通过项目本地 `tsc` 使用 TypeScript 7，但
  `experimental.useTypeScriptCli` 仍是实验配置；
- TypeScript 7.0 尚未提供第三方工具依赖的 JavaScript compiler API；
- npm 上最新 `typescript-eslint@8.66.0` 的 TypeScript peer range 仍为
  `>=4.8.4 <6.1.0`，没有正式支持 TS7；
- 当前依赖树中的 `typescript-eslint`、`ts-api-utils`、
  `react-docgen-typescript`、Storybook 和部分配置加载工具仍会使用 `typescript`。

因此现在不能把根 `typescript` 直接替换为 TS7，也不能通过忽略 peer dependency、
关闭 lint 或关闭 Storybook 检查制造单轨绿灯。

## 必须关注的上游入口

- TypeScript 7.0 announcement：
  `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/`
- TypeScript releases：`https://github.com/microsoft/typescript-go/releases`
- typescript-eslint dependency versions：
  `https://typescript-eslint.io/users/dependency-versions/`
- typescript-eslint TS7 issue：
  `https://github.com/typescript-eslint/typescript-eslint/issues/12518`
- Next.js TypeScript 7 / `useTypeScriptCli`：
  `https://nextjs.org/docs/app/api-reference/config/typescript#using-typescript-7`
- Storybook releases：`https://github.com/storybookjs/storybook/releases`
- react-docgen-typescript releases：
  `https://github.com/styleguidist/react-docgen-typescript/releases`

在以下任一事件发生时重新检查：

- TypeScript 7.1 或后续版本发布 JavaScript API；
- `typescript-eslint` 正式版本的 peer range 开始包含 TS7；
- Storybook 或 `react-docgen-typescript` 宣布支持 TS7；
- Next.js 修改、稳定或移除 `useTypeScriptCli`；
- 当前 TS7/TS6 alias 开始产生 install、lint、type-check 或 build 故障；
- 项目升级 Next.js、ESLint、Storybook 或 typescript-eslint major/minor。

## 实时检查命令

查看本地两个 TypeScript 入口：

```bash
pnpm exec tsc --version
node -p 'require("typescript/package.json").version'
pnpm why typescript
pnpm why @typescript/native
```

查看 typescript-eslint 最新支持范围：

```bash
pnpm view typescript-eslint@latest version peerDependencies --json
pnpm view @typescript-eslint/parser@latest version peerDependencies --json
```

不要只看版本号。TypeScript 发布新版本不等于 ESLint、Storybook 和 docgen 已经适配。

## 什么时候可以拆除

迁移到单轨 TS7 必须同时满足：

1. `typescript-eslint` 正式支持 TS7，不需要 pnpm override、`--force` 或忽略 warning；
2. Storybook、react-docgen 和配置加载链可以在根 `typescript@7` 下正常工作；
3. Next.js 使用 CLI checker 构建成功，且接受原生 `tsc` diagnostics 取代 Next.js
   特定错误框；
4. 干净安装后没有工具要求项目显式提供 TS6；
5. 完整本地检查、Next/OpenNext 构建、浏览器检查和 PR CI 全绿。

如果根配置不再显式保留 TS6，但某个工具仍自行安装 TS6，只能称为“移除手工双轨”。
只有 `pnpm why typescript` 和 lockfile 不再出现 TS6，才能称为“纯 TS7 单轨”。

## 单轨迁移步骤

在独立小 PR 中执行，不与 Next.js、OpenNext、ESLint 或 Storybook 大版本升级混在一起：

1. 保留当前双轨状态作为可随时恢复的基线；
2. 在同一个迁移 PR 中，把根 `typescript` 切换为已批准的 TS7 正式版本，
   同时删除只用于双轨的 `@typescript/native`；
3. 将 `experimental.useTypeScriptCli` 显式改为 `true`，迁移验证阶段不依赖
   Next.js 的默认值；
4. 更新 lockfile，确认没有 peer dependency 强制或 unsupported warning；
5. 把双轨架构合同改成单轨合同；
6. 顺序执行完整验证；
7. 验证成功后，再单独决定是否删除显式的 `useTypeScriptCli: true`。

根 `typescript`、`@typescript/native`、`useTypeScriptCli` 和架构合同必须在一个迁移
PR 中一起切换，不要把任意一项先合并成半完成状态。如果验证失败，整个
迁移 PR 不合并，主分支继续使用已验证的双轨基线。

### 本地迁移验证

在 lockfile 更新后，从干净安装开始顺序执行：

```bash
pnpm install --frozen-lockfile
pnpm exec prettier --check package.json next.config.ts tests/architecture/next-config-contract.test.ts
git diff --check
pnpm website:check
node scripts/quality/checks/client-boundary.js --build-artifacts
pnpm component:check
pnpm react:doctor
pnpm website:build:cf
pnpm release:verify
```

`pnpm website:check` 已包含生产与测试 TypeScript、ESLint、Vitest 和普通
Next build。`client-boundary --build-artifacts` 必须紧跟这次普通 build，在
Cloudflare build 改写 `.next` 之前执行。`component:check` 覆盖组件治理和
Storybook build；`release:verify` 是仓库统一的 release proof 入口。

如果迁移 PR 同时修改文档，还要用 Prettier 检查对应 Markdown 文件，并逐项
确认新增的内部引用指向已跟踪文件。仓库当前没有独立的 Markdown 链接检查
脚本，不要把人工核对写成自动门禁。

`pnpm build`、`pnpm website:build:cf` 和 Playwright webServer 共用 `.next`，不得并行。

### PR CI 必须确认

本地验证通过后，还要确认 PR CI 中的以下结果：

- 基础质量：TypeScript、ESLint、内容与翻译、client-boundary、Storybook、
  dependency-cruiser 和 Knip；
- 单元与集成测试；
- Semgrep 安全扫描；
- Cloudflare 构建证明：普通 build、构建产物 client-boundary、OpenNext build 和
  Cloudflare artifact 检查；
- 浏览器冒烟和 CI 汇总。

所有 PR 检查通过后才能合并，合并后还要确认 exact `main` SHA 的 CI。

## 不通过时怎么处理

以下任一情况都停止单轨迁移：

- ESLint 报 unsupported TypeScript 或加载 compiler API 失败；
- Storybook/docgen 无法读取组件类型；
- Next.js CLI checker 检查了意外文件，且不能通过正常 `tsconfig` 边界解决；
- Next/OpenNext build、Playwright 或现有架构合同退化；
- 只能通过关闭质量门禁、强制 peer dependency 或长期 patch 才能继续。

回滚只需恢复 `@typescript/native`、`@typescript/typescript6`、
`useTypeScriptCli: false` 和双轨合同，再恢复上一份已验证 lockfile。这个回滚不涉及
Cloudflare 数据、R2、环境变量或线上 Worker。
