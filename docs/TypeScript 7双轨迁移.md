# TypeScript 7 迁移观察

本文档记录主线为什么统一使用 TypeScript 6.0.2、需要关注哪些上游变化，以及满足
什么条件后才可以单独评估 TypeScript 7。代码、lockfile、实时 package peer range
和实际验证结果优先于本文档中的时间点快照。

本文档是一份受控临时文档。日期快照只解释
当前决定，不自动批准未来升级；触发重新检查时必须查询实时来源。

## 当前决定

项目主线统一使用 TypeScript 6.0.2：

- `typescript@6.0.2` 同时提供 CLI 和 JavaScript compiler API；
- `type-check`、`type-check:tests`、Next.js、ESLint 和其他工具解析同一版本；
- `next.config.ts` 保持 `experimental.useTypeScriptCli: false`，继续使用 Next.js
  默认的 JavaScript compiler API 路线；
- `tests/architecture/next-config-contract.test.ts` 锁住单一版本，防止依赖整理时
  重新引入额外 CLI。

TypeScript 7 不进入主线，也不会进入浏览器或 Cloudflare Worker；如需验证，只能在
独立实验分支中进行。

## 当前状态

- 项目 CLI 与工具链均为 TypeScript `6.0.2`；
- Next.js 16.3 的 TypeScript CLI 入口仍是实验能力，主线保持关闭；
- TypeScript 7 生态兼容性必须重新以实时 peer range、安装、lint、type-check 和
  build 结果证明，不能只看 npm 版本号；
- 不允许通过忽略 peer dependency、关闭 lint 或关闭其他质量门禁制造绿灯。

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

查看本地 TypeScript 基线：

```bash
pnpm exec tsc --version
node -p 'require("typescript/package.json").version'
pnpm why typescript
```

查看 typescript-eslint 最新支持范围：

```bash
pnpm view typescript-eslint@latest version peerDependencies --json
pnpm view @typescript-eslint/parser@latest version peerDependencies --json
```

不要只看版本号。TypeScript 发布新版本不等于 ESLint、Storybook 和 docgen 已经适配。

## 什么时候可以重新评估

重新评估 TS7 必须同时满足：

1. `typescript-eslint` 正式支持 TS7，不需要 pnpm override、`--force` 或忽略 warning；
2. Storybook、react-docgen 和配置加载链可以在根 `typescript@7` 下正常工作；
3. Next.js 使用 CLI checker 构建成功，且接受原生 `tsc` diagnostics；
4. 干净安装后没有工具要求项目显式提供 TS6；
5. 完整本地检查、Next/OpenNext 构建、浏览器检查和 PR CI 全绿。

如果某个工具自行安装其他 TypeScript 版本，仍需单独记录并验证；不能把它描述成
项目主线的主动基线。

## 独立实验步骤

在独立小 PR 中执行，不与 Next.js、OpenNext、ESLint 或 Storybook 大版本升级混在一起：

1. 保留当前 TypeScript 6.0.2 状态作为可随时恢复的基线；
2. 在同一个实验 PR 中，把根 `typescript` 切换为已批准的 TS7 正式版本；
3. 将 `experimental.useTypeScriptCli` 显式改为 `true`，迁移验证阶段不依赖
   Next.js 的默认值；
4. 更新 lockfile，确认没有 peer dependency 强制或 unsupported warning；
5. 把 TypeScript 6 架构合同改成实验合同；
6. 顺序执行完整验证；
7. 验证成功后，再单独决定是否删除显式的 `useTypeScriptCli: true`。

根 `typescript`、`useTypeScriptCli` 和架构合同必须在同一个实验 PR 中一起切换，
不要把任意一项先合并成半完成状态。如果验证失败，主分支继续使用已验证的
TypeScript 6.0.2 基线。

### 本地迁移验证

任何实验 PR 都必须从干净安装开始顺序执行：

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

回滚只需恢复 `typescript@6.0.2`、`useTypeScriptCli: false` 和单轨合同，再恢复上一份
已验证 lockfile。这个回滚不涉及
Cloudflare 数据、R2、环境变量或线上 Worker。
