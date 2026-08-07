# Phase 2 clean-room 执行计划

## 目标

从 `candidate-2026-08-06.1` 独立派生三个虚构 B2B 站，捕获真实修改面和结构性失败，判断模板是否已经接近“新业务主要修改设计和内容即可使用”。

## Task 1：冻结候选快照

1. 确认 `build/template-v1` 工作树除本计划文档外没有未提交实现改动，并确认提交 `8e241ea` 存在。
2. 在提交 `8e241ea` 上创建 annotated tag `candidate-2026-08-06.1`，message 为 `Phase 2 clean-room candidate 1`。
3. 记录 `git rev-parse candidate-2026-08-06.1^{commit}`。
4. 确认 tag 没有被解释为稳定版本或公开上线状态。

## Task 2：建立 brief 和证据骨架

创建：

```text
docs/clean-room/phase-2/briefs/product-catalog.md
docs/clean-room/phase-2/briefs/service-business.md
docs/clean-room/phase-2/briefs/hybrid-offering.md
docs/clean-room/phase-2/run-1/
```

每个 brief 必须写清：公司事实、offerings、路由、导航、SEO、询盘行为、允许修改区域、禁止修改区域和验证命令。不得写 `TBD` 或依赖执行者自行补业务事实。

## Task 3：建立三个隔离实验目录

根目录：

```text
/Users/Data/workspace/B2B Inquiry Site Base Clean Rooms
```

从同一 tag 建立：

```text
product-catalog
service-business
hybrid-offering
```

每个目录必须处于 detached HEAD，`git rev-parse HEAD` 必须等于 candidate tag commit。不得复制主仓当前未提交文件。

## Task 4：产品目录型派生

实现 Northline Process Equipment：

- offerings：Compact Transfer Pump、Chemical Dosing Skid、Mobile Filtration Unit；
- 路由：`/products` 和三个产品详情页；
- 导航：首页、Products、About、Request Quote、Contact；
- 每个产品页提供带 canonical `offeringId` 的询盘入口；
- 更换站点身份、SEO、公开联系方式、messages 和视觉 token；
- 不恢复旧 catalog 常量、product kind、动态 schema 或兼容字段。

先运行业务相关测试，再完成静态检查。若必须修改禁止区域，停止扩展并记录结构性失败。

## Task 5：纯服务型派生

实现 FieldAxis Reliability Services：

- offerings：Site Inspection、Preventive Maintenance、Fault Diagnostics；
- 路由：`/services` 和三个服务详情页；
- 导航：首页、Services、About、Request Quote、Contact；
- 页面围绕现场条件、服务区域和项目范围；
- 更换站点身份、SEO、公开联系方式、messages 和视觉 token；
- 不添加产品目录模型或服务型运行时 mode。

先运行业务相关测试，再完成静态检查。若必须修改禁止区域，停止扩展并记录结构性失败。

## Task 6：混合型派生

实现 ModuCore Industrial Systems：

- 标准 offerings：Standard Control Panel、Modular Monitoring Kit；
- 路由：`/solutions`、两个方案详情页和 `/custom-project`；
- 导航：首页、Solutions、Custom Project、About、Request Quote、Contact；
- 标准方案使用 canonical `offeringId`；
- custom request 使用自由文本 `interest` 和 `message`，不伪造 offering；
- 不添加动态表单系统、schema builder 或 provider abstraction。

先运行业务相关测试，再完成静态检查。若必须修改禁止区域，停止扩展并记录结构性失败。

## Task 7：控制端禁止区域审计

对每个实验运行：

```bash
git diff --name-only candidate-2026-08-06.1
git diff --check candidate-2026-08-06.1
```

禁止出现对以下范围的修改：

```text
src/app/api/inquiry/
src/lib/lead-pipeline/
src/lib/security/
src/lib/email/
src/lib/airtable/
scripts/quality/
scripts/starter-checks.js
open-next.config.ts
wrangler patches or release runner logic
```

场景专属的 `wrangler.jsonc` 公开名称和 `.invalid` URL 值允许修改；核心 binding 结构不允许修改。

## Task 8：逐场景完整验证

每个实验先执行：

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm type-check:tests
pnpm lint:check
pnpm test
pnpm content:check
pnpm knip:check
pnpm exec prettier --check .
```

随后严格串行执行：

```bash
pnpm exec playwright test --project=chromium
pnpm build
pnpm website:build:cf
node scripts/starter-checks.js cf-static-asset-headers
pnpm exec wrangler deploy --dry-run --env preview
```

最后执行 strict sentinel：

```bash
PUBLIC_LAUNCH_STRICT=true APP_ENV=production NODE_ENV=production node scripts/starter-checks.js validate-production-config
```

预期 strict sentinel 非零，并分开列出虚构/未确认身份 sentinel 与真实 secret/binding readiness blocker。

## Task 9：保存证据

每个实验保存：

```bash
git diff --binary candidate-2026-08-06.1 > <scenario>.patch
git diff --name-status candidate-2026-08-06.1
git diff --stat candidate-2026-08-06.1
```

报告必须写明实际 exit code、测试数量、Playwright 数量、build 版本、OpenNext 版本、Wrangler dry-run 结果、禁止区域扫描和结构性问题。不得把预期结果写成已验证结果。

## Task 10：汇总和判定

`run-1-summary.md` 分开列出：

- 三个场景共同修改的文件；
- 仅单个场景需要的业务文件；
- 禁止区域触碰；
- 模板说明不足；
- 重复出现的结构问题；
- `PASS`、`TEMPLATE_STRUCTURAL_FAILURE` 或 `VERIFICATION_BLOCKED`。

若任一场景不是 `PASS`：

1. 不修实验站底层；
2. 在模板仓为真实根因写最小修复；
3. 完整验证模板；
4. 创建下一 candidate tag；
5. 从零重做三个场景。

若三个场景均为 `PASS`，只记录已获得 clean-room 证据，不改变模板稳定状态。

## Task 11：提交证据和清理实验目录

1. 提交 briefs、patch、场景报告和汇总报告。
2. 确认模板仓工作树干净。
3. 将三个临时实验目录移动到 macOS Trash。
4. 清理失效的 worktree 注册信息，但不得永久删除实验业务文件。
5. 保留 candidate tag、提交 SHA 和报告，供 mutation 阶段复用。
