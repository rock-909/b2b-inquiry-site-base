# OpenNext Cloudflare Draft 适配器

本文档记录模板当前为什么固定 OpenNext 预览包并维护一个本地补丁，以及后续如何
验证、升级和回滚。代码、lockfile、Cloudflare 配置和实时上游状态优先于本文档中的
时间点快照。

这是 `docs/README.md` 中“不得长期维护提交快照”规则的受控例外。日期快照只说明
当时为什么保留当前组合，不自动批准后续部署或升级。

## 当前决定

Cloudflare 是模板和派生项目的正式运行基线。当前组合必须原子保留：

1. `package.json` 固定 OpenNext PR #1318 的已验证 commit
   `69807b1bd7acfafc87080656742f64a3e7470d62`，提供 Cache Components /
   Partial Prefetching 的 workerd 兼容修复；
2. `pnpm-workspace.yaml` 通过 `patchedDependencies` 应用
   `patches/@opennextjs__cloudflare@1.20.2.patch`；
3. 本地补丁带入 PR #1309 的 Node middleware bundler，并保留
   `patchInstrumentation`，把 Next.js 16.3 生成的 Node `src/proxy.ts`
   转换成 workerd 可执行的单文件。

这不是项目 fork，也不是可选开发工具。只要 `src/proxy.ts` 存在，补丁就是
`pnpm website:build:cf` 的构建依赖。不能只删除 OpenNext 的 Node middleware
构建保护后继续发布。

## 2026-08-11 状态快照

- OpenNext 正式最新版仍为 `@opennextjs/cloudflare@1.20.2`；
- PR #1309 `feat: support Node.js middleware (proxy.ts)` 仍为 Open，head 为
  `0762b49cd20da05d4ca830f76bafce28a10a864e`；
- PR #1318 `fix: support Cache Components on Workers` 仍为 Open，head 为
  `69807b1bd7acfafc87080656742f64a3e7470d62`；
- PR #1309 当前 head 仍未调用本项目实测需要的 `patchInstrumentation`；
- 因此继续保留固定预览包和本地补丁，不切换到移动 PR 引用。

## Node proxy 补丁解决什么问题

Next.js 16.3 将 `src/proxy.ts` 编译为 Node middleware。原版 OpenNext 1.20.2
检测到 Node middleware 后会直接退出，因为 workerd 不能像普通 Node.js 服务器那样
在运行时读取本地文件、动态加载 middleware/chunk 或执行未改写的 instrumentation
加载链。

本地补丁把这条运行时加载链改为构建时打包：

- 继续构建而不是在 Node middleware 检测处退出；
- 将编译后的 middleware、webpack/Turbopack chunks、manifest、OpenNext handler
  和必要配置打入 `.open-next/middleware/handler.mjs`；
- 将 Node 内置模块交给 Wrangler 的 `nodejs_compat`；
- 让 `.wasm` 和 `.bin` 继续由 Wrangler 处理；
- 通过 `patchInstrumentation` 消除 workerd 无法执行的动态
  `instrumentation.js` 加载。

`wrangler.jsonc` 必须继续启用 `nodejs_compat`。补丁匹配失败必须让安装或构建
失败，不能静默发布未修补的 Worker。

## 模板里的实际请求链

```text
Cloudflare Worker
  -> .open-next/middleware/handler.mjs
  -> src/proxy.ts
     -> 请求交给 next-intl
  -> Next.js 页面
```

模板当前不维护产品 slug 白名单。现有 `/products` 是通用目录路由，未知路径的
HTTP 404 由现有路由测试继续保护。

派生项目如果增加“有限 slug 集合”的动态公开路由，必须验证首次请求的真实 HTTP
状态。若流式渲染会把业务 404 固定成 200，应在同一个 `src/proxy.ts` 中加入最窄的
提前判断，并补 route-level 测试；不要建立第二个入口或恢复 `src/middleware.ts`。

## Cache Components 适配

PR #1318 处理 Cache Components 在 Node.js 与 workerd 间的三个差异：

1. 替换依赖 Node timer 内部字段的分阶段渲染调度；
2. 把模块加载信号绑定到当前 Cloudflare request context，避免并发请求互相污染；
3. 避免把只有 shell、没有 postponed state 的 PPR 缓存当成完整页面返回。

这些补丁只在应用开启 Cache Components 时注册。OpenNext 补丁匹配失败会阻止构建，
这是必须保留的 fail-closed 行为。

`open-next.config.ts` 继续使用 `r2IncrementalCache`。Preview 与 Production
必须使用不同的 `NEXT_INC_CACHE_R2_BUCKET`，不能共享 bucket。

`src/app/[locale]/request-quote/page.tsx` 保持 `instant = false`。询盘页完整
HTML、无 JavaScript fallback 和布局稳定性优先于 Instant Navigation。

## R2 预填充边界

`opennextjs-cloudflare deploy` 可能在发布应用 Worker 前启动临时远程 Worker，
把构建期增量缓存写入 R2。辅助上传失败不自动等于应用 Worker 或 R2 binding 失效，
但也不能忽略。

排查顺序：

1. 核对目标环境和 bucket binding；
2. 用 Wrangler 对同一 bucket 做最小、可回收的直接读写验证；
3. 若直接读写失败，先处理网络、凭据或 R2 服务问题，不发布；
4. 若只有辅助上传失败，优先使用 OpenNext 官方支持的恢复路径，并记录构建 SHA、
   Worker Version ID 和完整 deployed smoke 结果。

不要把其他项目的手工 cache key、写入数量或历史 Preview 事故当成模板合同。

## 何时可以删除本地补丁

只有正式 OpenNext release 同时满足以下条件，才单开迁移 PR：

- 正式支持 Next.js 16 `proxy.ts` / Node middleware bundling；
- 正式包含 Cache Components / PPR request isolation 修复；
- bundler 已覆盖 instrumentation 动态加载问题；
- 当前 Next.js、Wrangler 和 workerd 组合完成本地构建、dry-run 与真实 Preview
  验证。

只覆盖其中一部分时，保留仍未被正式版本覆盖的 patch layer。不要因为 PR 合并、
Preview 单绿或正式包版本号变大就直接删除补丁。

## 实时检查

```bash
gh pr view 1309 --repo opennextjs/opennextjs-cloudflare \
  --json isDraft,state,mergeStateStatus,headRefOid,updatedAt
gh pr view 1318 --repo opennextjs/opennextjs-cloudflare \
  --json isDraft,state,mergeStateStatus,headRefOid,updatedAt
gh api repos/opennextjs/opennextjs-cloudflare/releases/latest \
  --jq '{tag_name,published_at,html_url}'
```

以下事件触发重新检查：

- PR #1309 或 #1318 head 改变、合并或关闭；
- OpenNext 发布新 patch/minor；
- Next.js 或 Wrangler 升级；
- pnpm 报 patch matcher/hash 错误；
- OpenNext build 不再生成 `.open-next/middleware/handler.mjs`；
- Worker 出现全站 500、空响应、截断 HTML/RSC、跨请求 I/O 错误或持续 cache MISS。

## 验证

依赖、补丁、Next.js 或 Cloudflare 配置变化后按顺序执行，不能并行共享 `.next`
的任务：

```bash
pnpm install --frozen-lockfile
pnpm content:check
pnpm type-check
pnpm type-check:tests
pnpm lint:check
pnpm test
pnpm react:doctor
pnpm build
pnpm website:build:cf
test -f .open-next/middleware/handler.mjs
pnpm exec wrangler deploy --dry-run --env preview
pnpm exec playwright test
```

Cloudflare build 日志必须实际出现 `Bundling Node.js middleware`。生成物存在只证明
打包完成；正式上线仍需真实 Preview/Production deployed smoke、R2 行为和 owner
验收，不能由本地 build、CI 或 dry-run 替代。

## 回滚

优先恢复上一个已验证的 Cloudflare Worker version，不删除 R2 bucket。

若必须从代码回滚：

1. 回到上一个同时包含 OpenNext pin、patch、lockfile 和 `src/proxy.ts` 的已验证
   commit；
2. 顺序重跑 Next build、OpenNext build、Wrangler dry-run 和 deployed smoke；
3. 只有明确撤回 Cloudflare/Node proxy 基线时，才能原子移除
   `src/proxy.ts`、`patchedDependencies` 和补丁；不能单独删其中一项。
