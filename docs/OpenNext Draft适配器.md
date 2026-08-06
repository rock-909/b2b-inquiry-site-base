# OpenNext Cache Components Draft 适配器

本文档记录当前生产环境为什么使用尚未正式发布的 OpenNext Cache
Components 适配器，以及后续如何跟踪、升级和回滚。代码、lockfile、Cloudflare
binding 和实时 PR 状态优先于本文档中的时间点快照。

本文档是 `docs/README.md` 中“不得长期维护提交快照”规则的受控例外。日期快照只说明
当时为什么批准固定 commit，不自动批准后续部署或升级。每次触发下文的重新检查条件
时，都要查询实时来源并同步更新本节；无法确认时继续使用最后一个已验证 commit，不
根据旧快照推断上游现状。

## 当前决定

生产环境接受 OpenNext PR #1318 的受控风险，并启用：

- Next.js `cacheComponents`；
- Partial Prefetching / Instant Navigations；
- R2 Incremental Cache；
- 独立的 Preview 和 Production R2 bucket。

这不是无条件跟随 PR 最新代码。`package.json` 固定到已经验证过的 commit
`69807b1bd7acfafc87080656742f64a3e7470d62`，不使用会随 PR 更新的 `@1318`
引用。任何新 commit 或正式版本都必须重新验证后才能采用。

## 2026-08-04 状态快照

- PR #1318 标题为 `fix: support Cache Components on Workers`；
- PR 状态为 Open，已经不是 Draft；
- 当前需要 maintainer review，尚未合并；
- 当前 head 为 `69807b1bd7acfafc87080656742f64a3e7470d62`；
- lint、format、TypeScript、单元/集成测试和 Continuous Releases 均通过；
- changeset 标记为 `@opennextjs/cloudflare` patch release；
- 当前正式最新版仍为 `@opennextjs/cloudflare@1.20.2`，尚不包含该 PR。

因此当前风险等级是 **中低、可管理**，不是生产 blocker。主要剩余风险是
“尚未完成官方 review 和正式发布”，不是“当前实现没有通过验证”。

## 这个适配器解决什么问题

Cache Components 在 Node.js 和 Cloudflare workerd 上的计时器、请求隔离和 PPR
恢复行为不同。PR #1318 处理三个已经在真实应用中观察到的问题：

1. **分阶段渲染可能卡住**：Next.js 的调度代码使用 Node timer 内部字段，
   workerd 没有相同实现。适配器把它替换为 workerd 可用的顺序任务调度。
2. **并发请求可能互相污染**：模块加载信号原本可能跨请求共享 timer handle，
   导致空响应、截断 HTML/RSC，甚至让同一 isolate 后续请求继续异常。适配器把
   信号绑定到当前 Cloudflare request context。
3. **缓存的 PPR shell 可能被当成完整页面返回**：缓存拦截层只有 shell，
   没有 postponed state。适配器让这类请求回到 Next handler，继续完成恢复渲染。

这些补丁只在应用开启 Cache Components 时注册。如果未来 Next.js 输出结构变化、
补丁无法匹配，OpenNext 会让构建直接失败，而不是悄悄发布一个未修补的 Worker。
这是重要的 fail-closed 保护。

## 当前项目配置

| 环境 | Binding | Bucket |
| --- | --- | --- |
| Preview | `NEXT_INC_CACHE_R2_BUCKET` | `tucsenberg-site-cache-preview` |
| Production | `NEXT_INC_CACHE_R2_BUCKET` | `tucsenberg-site-cache-production` |

两个环境不共享 bucket，因此不需要额外配置 `NEXT_INC_CACHE_R2_PREFIX`。不要把
Production binding 指向 Preview bucket。

`open-next.config.ts` 使用 OpenNext 自带的 `r2IncrementalCache`。适配器读取不到
bucket 时会抛出可忽略的 cache error；普通 R2 读写异常会退化为 cache miss 或记录
写入错误。R2 故障不应被当成可以忽略的长期状态，但短时故障通常不会等同于整站
不可用。

`src/app/[locale]/request-quote/page.tsx` 保持 `instant = false`。询盘页的完整
HTML、无 JavaScript fallback 和布局稳定性优先于 Instant Navigation。

Cache Components 会先发送动态路由的静态 shell。如果路由开始流式输出后才调用
`notFound()`，页面会显示 not-found UI 和 `noindex`，但 HTTP 状态可能已经固定为
`200`。当前产品目录是有限 slug 集合，因此 `src/middleware.ts` 会在流式输出前拦截
不存在的产品 slug，直接返回真实 `404`。以后新增有限集合的动态公开路由时，也要
明确验证第一次请求的状态码，不能只看页面内容或依赖 Playwright retry。

## R2 预填充辅助 Worker

`opennextjs-cloudflare deploy` 发布 Worker 前，会启动一个临时远程 Worker，把构建期
生成的增量缓存写入 R2。这个上传辅助链路不等于线上应用 Worker：它失败时，先分别
检查 R2 bucket、Wrangler 直接对象写入和已经部署的 Worker，不要直接判断整站缓存
实现失效。

2026-08-04 的 Preview 验收中，临时辅助 Worker 持续返回 HTTP 500，但同一账号通过
`wrangler r2 object put --remote` 能正常写入同一 bucket。最终按 OpenNext 计算出的
正式 cache key 写入全部 40 个构建缓存，再用 `OPEN_NEXT_DEPLOY=true wrangler deploy`
发布同一构建产物，远端 smoke、R2/预取检查和未知产品 404 均通过。这证明当次故障在
辅助上传路径，而不是 R2 binding 或应用运行时。

再次遇到时按以下顺序处理：

1. 确认目标环境指向正确 bucket，并用 Wrangler 直接写入一个本次构建的真实 cache
   object；不要用无关临时 key 污染 bucket。
2. 如果直接写入也失败，先处理网络、代理、凭据或 R2 服务问题，不发布。
3. 如果只有辅助 Worker 失败，优先检查 OpenNext 后续版本或 PR 是否修复；生产部署可
   使用 CLI 官方 `--rclone` 路径，前提是已配置并验证所需 R2 凭据。
4. 手工写 cache key 再调用 Wrangler 只作为已验证构建的应急恢复，不做默认发布链；
   必须记录固定 commit、Worker Version ID、写入数量和完整远端 smoke 结果。

## 为什么可以接受当前风险

- PR 已经脱离 Draft，变更范围集中在 Cache Components/workerd 兼容层；
- 上游所有公开检查通过，并带有并发 RSC 回归测试；
- 补丁只在 `cacheComponents: true` 时启用；
- 补丁匹配失败会阻止构建，不会静默降级；
- 本项目已经用全量测试、Next/OpenNext build、no-JS Playwright 和 React
  Doctor 覆盖这条升级链；
- 真实 Cloudflare Preview 已覆盖 R2 MISS/HIT、普通 RSC、route tree、page
  segment、重复 smoke、并发请求和并发后的 isolate 健康。

仍然存在但已接受的风险：

- PR 尚未正式合并，maintainer review 可能要求修改；
- 临时包由 `pkg.pr.new` 分发，不具备正式 npm release 的长期承诺；
- 补丁依赖 Next.js 构建产物的内部结构，因此升级 Next.js 时必须重新构建验证；
- 原始并发故障依赖 timing，测试能大幅降低风险，但不能数学上证明永不发生。

## 必须关注的上游入口

- PR #1318：`https://github.com/opennextjs/opennextjs-cloudflare/pull/1318`
- OpenNext releases：`https://github.com/opennextjs/opennextjs-cloudflare/releases`
- OpenNext changelog：`https://opennext.js.org/cloudflare/changelog`
- Next.js 16.3 release：`https://nextjs.org/blog/next-16-3`
- Next.js Cache Components：`https://nextjs.org/docs/app/getting-started/cache-components`
- Next.js Partial Prefetching：`https://nextjs.org/docs/app/guides/adopting-partial-prefetching`

在以下任一事件发生时重新检查：

- PR #1318 head commit 改变；
- PR 被合并或关闭；
- OpenNext 发布新 patch/minor；
- Next.js 升级；
- OpenNext build 开始报 patch matcher 错误；
- 线上出现空响应、截断 HTML/RSC、`failed to pipe response`、
  `Cannot perform I/O on behalf of a different request` 或持续 cache MISS。

## 检查命令

查看 PR 当前状态和固定 commit：

```bash
gh pr view 1318 --repo opennextjs/opennextjs-cloudflare \
  --json isDraft,state,mergeStateStatus,reviewDecision,headRefOid,updatedAt
gh pr checks 1318 --repo opennextjs/opennextjs-cloudflare
```

查看正式版本：

```bash
gh api repos/opennextjs/opennextjs-cloudflare/releases/latest \
  --jq '{tag_name,published_at,html_url}'
```

检查项目仍然固定在已批准 commit，且两个环境都有独立 R2：

```bash
node scripts/starter-checks.js cf-official-compare
pnpm exec wrangler r2 bucket list
```

## 上游变化时怎么处理

### PR 出现新 commit

不要把依赖改回 `@1318`，也不要自动跟随。先阅读从当前固定 commit 到新 head 的
diff，确认仍然只影响 Cache Components 兼容层，再把依赖改为新的完整 commit，更新
lockfile，并执行本文档的完整验证。

### PR 合并但还没有正式 release

继续使用当前固定 commit。合并本身不要求立即换包，等待带 changeset 的正式版本。

### 正式 release 包含 PR #1318

把临时 URL 替换为正式 semver，更新 lockfile，并重新执行完整验证。确认正式包通过
后，更新本文档状态快照和 `cf-official-compare` 中的依赖合同。

### PR 被关闭且没有合并

不要继续升级 Next.js 或临时 adapter。短期可以保留已经验证并带 integrity 的固定
产物；下一次生产变更前必须选择以下之一：

- 找到官方替代实现并重新验证；
- 关闭 `partialPrefetching` 和 `cacheComponents`，撤回 R2 adapter；
- 明确维护内部 patch，并承担后续 Next.js 兼容成本。

默认选择前两项，不主动维护长期 fork。

## 正式版本迁移验证

依赖或 Next.js 变化后顺序执行，不能并行构建：

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm type-check:tests
pnpm lint:check
pnpm exec vitest run
pnpm build
pnpm website:build:cf
pnpm react:doctor
node scripts/starter-checks.js cf-official-compare
pnpm exec wrangler deploy --dry-run --env production
```

部署生产候选 Worker 后，还必须对真实 URL 执行 deployed smoke、R2 MISS/HIT、普通
RSC、route tree、page segment、并发请求和并发后的顺序请求。Preview 结果不能替代
Production Worker 的这一步。

## 回滚

最快且风险最低的回滚方式是恢复上一个已验证的 Cloudflare Worker version，不删除
R2 bucket。缓存数据可以保留，回滚不依赖清空 R2。

如果必须从代码回滚：

1. 恢复正式 OpenNext 版本；
2. 移除 `r2IncrementalCache`；
3. 关闭 `partialPrefetching` 和 `cacheComponents`；
4. 顺序重跑 Next/OpenNext build 和 deployed smoke；
5. R2 binding 可以暂时保留，不需要为回滚删除 bucket。
