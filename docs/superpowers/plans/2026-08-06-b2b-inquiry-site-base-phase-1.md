# B2B Inquiry Site Base Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 Tucsenberg 的固定 tracked snapshot 建立独立仓库，并完成第一轮去品牌、减法和通用询盘中性化，得到可验证的 `INDEPENDENT_NEUTRAL_BASE_CANDIDATE`。

**Architecture:** 先保留一笔原样 donor snapshot commit，再用后续首笔实现提交和整组移出完成中性化。保留现有 Next/OpenNext/Cloudflare 与询盘安全链路，不引入 profile、generator、provider abstraction 或多站同步。

**Tech Stack:** Next.js 16.3、React 19.2.8、TypeScript 7/6 双轨、Vitest、Playwright、OpenNext Cloudflare、Wrangler、R2、Turnstile、Airtable、Resend。

---

### Task 1: 建立独立 donor snapshot

**Status:** Completed. Do not rerun.

**Recorded commits:**
- `a60ed413a71db54f8378fcc5985ad196b7fcd223` — `chore: import tucsenberg donor snapshot`
- `60f981505958331f2ce910e5e7a473a64148093f` — `docs: record template extraction plan`

**Files:**
- Create: `/Users/Data/workspace/B2B Inquiry Site Base/**`
- Create: `/Users/Data/workspace/B2B Inquiry Site Base/docs/superpowers/specs/2026-08-06-b2b-inquiry-site-base-design.md`
- Create: `/Users/Data/workspace/B2B Inquiry Site Base/docs/superpowers/plans/2026-08-06-b2b-inquiry-site-base-phase-1.md`
- Create: `/Users/Data/workspace/B2B Inquiry Site Base/docs/baseline/donor-provenance.md`

- [x] **Step 1: 再次确认 donor 干净且 SHA 正确**

Run:

```bash
git -C /Users/Data/code/tucsenberg-site status --short --branch
git -C /Users/Data/code/tucsenberg-site rev-parse HEAD
git -C /Users/Data/code/tucsenberg-site rev-parse origin/main
```

Expected: `main...origin/main` 无文件变更，两个 SHA 都是 `dcb9e2bbed164b484e1c8cbc1b08c7f140e84405`。

- [x] **Step 2: 从 tracked archive 创建新目录**

Run:

```bash
mkdir -p "/Users/Data/workspace/B2B Inquiry Site Base"
git -C /Users/Data/code/tucsenberg-site archive dcb9e2bbed164b484e1c8cbc1b08c7f140e84405 | tar -x -C "/Users/Data/workspace/B2B Inquiry Site Base"
```

Expected: 新目录包含 donor tracked files，不包含 `.git`、`.next`、`node_modules`。

- [x] **Step 3: 初始化独立分支并确认无 remote**

Run:

```bash
git -C "/Users/Data/workspace/B2B Inquiry Site Base" init -b build/template-v1
git -C "/Users/Data/workspace/B2B Inquiry Site Base" remote -v
```

Expected: 当前分支为 `build/template-v1`，remote 输出为空。

- [x] **Step 4: 验证并提交原样 snapshot**

Run:

```bash
diff -qr \
  <(git -C /Users/Data/code/tucsenberg-site ls-tree -r --name-only dcb9e2bbed164b484e1c8cbc1b08c7f140e84405) \
  <(git -C "/Users/Data/workspace/B2B Inquiry Site Base" ls-files --others --exclude-standard)
git -C "/Users/Data/workspace/B2B Inquiry Site Base" add -A
git -C "/Users/Data/workspace/B2B Inquiry Site Base" commit -m "chore: import tucsenberg donor snapshot"
```

Expected: tracked path list一致；首个 commit 的 tree 只包含 donor tracked snapshot。

- [x] **Step 5: 写入并提交来源证明和已批准规划**

Create `docs/baseline/donor-provenance.md`:

```markdown
# Donor provenance

- Donor repository: `/Users/Data/code/tucsenberg-site`
- Donor commit: `dcb9e2bbed164b484e1c8cbc1b08c7f140e84405`
- Import method: tracked files from `git archive`
- Imported on: `2026-08-06`
- Git history inherited: no
- Git remote inherited: no
```

将本设计规格和实施计划移动到新仓相同的 `docs/superpowers/**` 路径。

Run:

```bash
git -C "/Users/Data/workspace/B2B Inquiry Site Base" add -A
git -C "/Users/Data/workspace/B2B Inquiry Site Base" commit -m "docs: record template extraction plan"
```

Expected: 第二个 commit 只增加 provenance、设计规格和实施计划，不修改 donor 运行代码。

### Task 2: 建立独立项目身份和 sentinel 配置

**Status:** Completed in `516918f`; review corrections completed in `cf8acb6`.

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `wrangler.jsonc`
- Modify: `.env.example`
- Modify: `.dev.vars.example`
- Modify: `.env.production`
- Modify: `src/config/single-site.ts`
- Modify: `src/config/single-site-links.ts`
- Modify: `src/config/single-site-navigation.ts`
- Modify: `src/config/single-site-seo.ts`
- Create: `src/config/offerings.ts`
- Create: `src/config/__tests__/offerings.test.ts`
- Modify: `src/config/pages.config.ts`
- Modify: `src/config/paths/**`
- Modify: `.github/workflows/*.yml`

- [x] **Step 1: 写独立身份合同测试**

Create `tests/architecture/base-identity.test.ts`，使用真实导出断言：

```typescript
import { describe, expect, it } from "vitest";
import { SITE } from "@/config/single-site";

describe("base identity", () => {
  it("uses the obvious non-production reference identity", () => {
    expect(SITE.name).toBe("Northstar Industrial Reference");
    expect(SITE.url).toBe("https://example.invalid");
  });
});
```

字段名以 `src/config/single-site.ts` 当前真实导出为准；不得新增第二套身份对象。

- [x] **Step 2: 写 offering 权威真相合同测试**

Create `src/config/__tests__/offerings.test.ts`，断言 `src/config/offerings.ts` 只导出一个薄的 offerings 数组，元素至少包含 canonical `id` 和 `name`。第一版 reference site 可包含一个明显虚构的 `custom-fabrication`，也允许空数组支持纯 general inquiry；不要新增 profile、schema builder 或资源名生成器。

- [x] **Step 3: 运行测试确认先红**

Run:

```bash
pnpm exec vitest run tests/architecture/base-identity.test.ts src/config/__tests__/offerings.test.ts
```

Expected: 因当前仍是 Tucsenberg 身份而 FAIL。

- [x] **Step 4: 直接替换现有权威入口**

将 package 名改为 `b2b-inquiry-site-base`，站点示例身份改为 `Northstar Industrial Reference`，域名使用 `https://example.invalid`，公开邮箱使用 `sales@example.invalid`。Worker 和 R2 名使用明显 sentinel：

```text
b2b-inquiry-site-base-preview
b2b-inquiry-site-base-production
b2b-inquiry-site-base-next-cache-preview
b2b-inquiry-site-base-next-cache-production
```

不创建 `SiteProfile`、环境 profile 或资源名生成器。

- [x] **Step 5: strict sentinel 必须真实失败**

Run:

```bash
PUBLIC_LAUNCH_STRICT=true APP_ENV=production NODE_ENV=production node scripts/starter-checks.js validate-production-config
```

Expected: exit non-zero，并分开列出两类红灯：sentinel blockers（`example.invalid`、示例品牌/邮箱、sentinel 资源名等必须替换的位置）和缺生产 secret/binding 的环境 readiness blockers。sentinel blockers 是模板阶段预期红灯；缺 secret 不能被当作 sentinel 已证明的替代品。

- [x] **Step 6: 身份和 offering 测试转绿**

Run:

```bash
pnpm exec vitest run tests/architecture/base-identity.test.ts src/config/__tests__/offerings.test.ts
```

Expected: PASS。

### Task 3: 移出 Storybook 和 UI 治理 estate

**Files:**
- Move to Trash: `.storybook/**`
- Move to Trash: `src/stories/**`
- Move to Trash: `src/**/*.stories.tsx`
- Move to Trash: `src/components/component-governance.registry.json`
- Move to Trash: `scripts/component-governance-registry-truth.js`
- Move to Trash: `scripts/quality/checks/component-governance.js`
- Move to Trash: 对应 Storybook/component-governance tests
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/starter-checks.js`
- Modify: `knip.json`

- [ ] **Step 1: 记录移出清单并移动到 Trash**

使用 macOS `trash` 命令；若不可用，使用 Finder/AppleScript 移到 `~/.Trash`，不得使用 `rm`、`git clean` 或 `find -delete`。

- [ ] **Step 2: 删除对应引用和专属测试**

随运行对象移出 Storybook、component governance 的 tests、scripts、package scripts、CI step 和依赖。不要把专属测试改名伪装成通用测试。

- [ ] **Step 3: 确认不存在旧入口引用**

Run:

```bash
rg -n "component-governance|storybook" src tests scripts package.json .github knip.json
```

Expected: 运行代码、测试、package scripts、CI 和 Knip 中引用为零。不要在本任务处理产品运行面。

### Task 4: 移出产品运行面并建立薄的中性 reference site

**Files:**
- Move to Trash: `src/app/[locale]/products/**`
- Move to Trash: `src/app/[locale]/guides/**`
- Move to Trash: `src/app/[locale]/oem-wholesale/**`
- Move to Trash: `src/app/[locale]/warranty/**`
- Move to Trash: `src/components/products/**`
- Move to Trash: `src/constants/tucsenberg-product-*.ts`
- Move to Trash: `src/config/single-site-product-catalog.ts`
- Move to Trash: `src/config/single-site-page-expression.ts`
- Move to Trash: `content/pages/en/flood-barrier-*.mdx`
- Move to Trash: `content/pages/en/oem-wholesale.mdx`
- Move to Trash: `content/pages/en/warranty.mdx`
- Move to Trash: 对应 route/component/config tests
- Move to Trash: `messages/profiles/catalog/**`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/about/**`
- Modify: `src/app/[locale]/contact/**`
- Modify: `src/app/[locale]/request-quote/**`
- Modify: `src/app/sitemap.ts`
- Modify: `src/middleware.ts`
- Modify: `src/config/{pages.config,single-site,single-site-links,single-site-navigation,single-site-seo}.ts`
- Modify: `src/config/paths/{types,paths-config,utils}.ts`
- Modify: `src/lib/navigation.ts`
- Modify: `content/pages/en/{about,contact,privacy,terms}.mdx`
- Modify: `messages/base/en/messages.json`
- Modify: `messages/profiles/b2b-lead/en/messages.json`
- Modify: `messages/message-packs.json`
- Modify: `src/lib/i18n/composed-messages.ts`
- Modify: `src/types/next-intl.d.ts`
- Modify: `src/config/offerings.ts`
- Modify: `src/config/__tests__/offerings.test.ts`
- Modify: `src/components/layout/**`
- Modify: `src/components/footer/**`
- Move to Trash: 任何中性页面不再调用的产品 sections/grid 组件及其测试

`src/constants/product-catalog.ts` 仍被旧询盘链路使用，本任务暂不移出；到 Task 5 与 `product-identity.ts`、`product-inquiry-kinds.ts` 一起退出。`public/downloads/**` 和 `public/images/tucsenberg-*` 暂留到 Task 6，与 asset/header/Lighthouse 门禁同批处理。

- [ ] **Step 1: 先写核心路由行为测试**

更新现有 route/browser tests，使它们只要求：

```text
/
/about
/contact
/request-quote
/privacy
/terms
unknown route -> 404
```

不建立 route registry；测试读取真实路由和真实页面输出。

- [ ] **Step 2: 移出产品运行面并同步真实引用**

将列出的产品路由、组件、常量、配置、catalog messages 和业务 MDX 移到 Trash；同步更新 sitemap、middleware、导航、SEO、paths、layout/footer 和 message composition。不得先加兼容 re-export 或 product/service mode。

- [ ] **Step 3: 写最薄中性首页**

首页只包含 hero、简短价值说明和询盘 CTA。买家可见文案放在 messages/content 现有入口，不创建 section schema。

- [ ] **Step 4: 把内容换成明显虚构 sentinel**

About、Contact、Privacy、Terms 必须明确是 reference content，并让 strict production gate 阻止直接上线。法律文本不得写成可直接复用的正式法律意见。

- [ ] **Step 5: 写最薄 offerings 显示规则**

如果 reference site 展示 offering，数据只能来自 `src/config/offerings.ts` 的 canonical 数组。空 offerings 数组时隐藏 offering-specific UI，但 general inquiry 仍可用。不要创建 route registry、profile、schema builder 或动态表单搭建器。

- [ ] **Step 6: 运行聚焦测试**

Run:

```bash
pnpm exec vitest run src/app src/config src/components/layout src/components/footer tests/unit/routes tests/architecture/static-public-pages-contract.test.ts
```

Expected: 核心路由、metadata、sitemap、404、导航和 message composition 相关测试 PASS。

### Task 5: 中性化询盘字段闭包

**Files:**
- Modify: `src/config/offerings.ts`
- Modify: `src/config/__tests__/offerings.test.ts`
- Modify: `src/components/forms/inquiry-payload.ts`
- Modify: `src/components/forms/inquiry-form*.tsx`
- Modify: `src/lib/lead-pipeline/canonical-buyer-fields.ts`
- Modify: `src/lib/lead-pipeline/lead-schema.ts`
- Modify: `src/lib/lead-pipeline/process-lead.ts`
- Modify: `src/lib/lead-pipeline/inquiry-handoff.ts`
- Modify: `src/lib/lead-pipeline/utils.ts`
- Move to Trash: `src/lib/lead-pipeline/product-identity.ts`
- Move to Trash: `src/lib/lead-pipeline/product-inquiry-kinds.ts`
- Modify: `src/lib/email/email-data-schema.ts`
- Modify: `src/lib/email/runtime-email-content.ts`
- Modify: `src/lib/airtable/types.ts`
- Modify: `src/lib/airtable/service-internal/lead-records.ts`
- Modify: `src/app/api/inquiry/route.ts`
- Modify: `tests/integration/api/**`
- Modify: 相关 `src/**/__tests__/**`

- [ ] **Step 1: 把公共行为写成失败测试**

覆盖两种真实 payload：

```typescript
const generalInquiry = {
  fullName: "Ada Buyer",
  email: "ada@example.com",
  message: "Please contact me about this project.",
};

const offeringInquiry = {
  ...generalInquiry,
  interest: "Custom fabrication",
  offeringId: "custom-fabrication",
};
```

断言 `interest` 和 `offeringId` 从 browser payload 进入真实 Zod schema、email data 和 Airtable mapping；不通过源码字段清单扫描证明闭包。

同时覆盖：未知 `offeringId` 被拒绝；email/Airtable 使用服务端从 `src/config/offerings.ts` 解析出的 canonical id/name；浏览器提交的 offering name/label 被忽略；空 offerings 数组仍允许 general inquiry，但拒绝任何非空 `offeringId`。`interest` 仍是买家自由文本，只做自由文本清洗和截断。

- [ ] **Step 2: 运行聚焦测试确认先红**

Run:

```bash
pnpm exec vitest run src/config src/components/forms src/lib/lead-pipeline src/lib/email src/lib/airtable tests/integration/api
```

Expected: 新字段合同因旧 product model 而 FAIL。

- [ ] **Step 3: 最小改造真实链路**

删除 `catalogProductId`、`productInquiryKind`、`productName` 和 `Product Inquiry` 分支，使用可选 `interest`、`offeringId`。`offeringId` 只作为不可信输入进入服务端解析，未知 ID 拒绝；下游 email/Airtable 只接收 canonical offering id/name。保持既有安全边界和 provider 容错语义，不添加动态 schema、provider interface 或兼容 wrapper。

- [ ] **Step 4: 询盘聚焦测试转绿**

Run:

```bash
pnpm exec vitest run src/config src/components/forms src/app/api/inquiry src/lib/lead-pipeline src/lib/email src/lib/airtable tests/integration/api
```

Expected: 表单、schema、offeringId 服务端解析、未知 ID 拒绝、honeypot、Turnstile、email-first、Airtable、单边成功、双边失败和日志脱敏测试 PASS。

### Task 6: 收缩质量门禁并完成 residue 扫描

**Files:**
- Modify: `scripts/quality/checks/cloudflare-smoke.js`
- Modify: `scripts/quality/checks/content-readiness.js`
- Modify: `scripts/quality/checks/production-config.js`
- Modify: `scripts/quality/checks/release-proof-manifest.js`
- Modify: `scripts/quality/message-key-usage-baseline.js`
- Modify: `lighthouserc.js`
- Modify: `tests/unit/scripts/**`
- Modify: `tests/e2e/**`
- Create: `docs/baseline/first-neutralization-report.md`

- [ ] **Step 1: 删除业务探针，不建设可配置探针框架**

将 `/products`、产品页、PDF、catalog messages、product photo readiness 等探针替换为 `/about`、`/contact`、`/request-quote` 和通用表单行为。只保留仍阻断真实错误的门禁。

- [ ] **Step 2: 执行一次性 residue 扫描**

Run:

```bash
rg -n -i "tucsenberg|flood barrier|flood-barrier|flood control|flood-control|catalogProductId|productInquiryKind|productName" --glob '!docs/baseline/donor-provenance.md' --glob '!docs/superpowers/**'
```

Expected: 运行代码、内容、资产、测试和配置均无结果。不要把 banned-string 扫描建设成永久 CI 负空间门禁。

- [ ] **Step 3: 记录第一轮范围与未完成项**

`docs/baseline/first-neutralization-report.md` 必须记录：donor SHA、当前模板 SHA、移出范围、保留技术线、验证命令和结果，以及 clean-room、mutation、真实 acceptance 尚未完成，当前状态仅为 `INDEPENDENT_NEUTRAL_BASE_CANDIDATE`。

### Task 7: 串行完成第一轮验证和独立复审

**Files:**
- Modify if required by failures: only files already in Tasks 2-6

- [ ] **Step 1: 安装和静态检查**

Run sequentially:

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm type-check:tests
pnpm lint:check
pnpm test
pnpm content:check
pnpm knip:check
```

Expected: 全部 exit 0。

- [ ] **Step 2: 串行运行浏览器和 Next build**

Run:

```bash
pnpm exec playwright test --project=chromium
pnpm build
```

Expected: Chromium 和 Next build exit 0。任何使用 Playwright webServer 的命令不得与 build 并行。

- [ ] **Step 3: 在同一 fresh `.next` 链上完成 Cloudflare build**

Run after `pnpm build`:

```bash
pnpm website:build:cf
pnpm exec wrangler deploy --dry-run --env preview
```

Expected: OpenNext build 和 Wrangler dry-run exit 0。

- [ ] **Step 4: 证明 sentinel 仍阻断 public launch**

Run:

```bash
PUBLIC_LAUNCH_STRICT=true APP_ENV=production NODE_ENV=production node scripts/starter-checks.js validate-production-config
```

Expected: exit non-zero，并分开列出 sentinel blockers（示例品牌、域名、邮箱或平台资源名）和缺生产 secret/binding 的环境 readiness blockers。sentinel blockers 是本阶段预期红灯；缺 secret 只是生产环境未配置，不能替代 sentinel 证明。

- [ ] **Step 5: 两阶段只读复审**

先做规格符合性复审，再做代码质量/过度工程复审。所有 blocker 回到对应任务修复并重验，不能用文档说明代替行为修复。

- [ ] **Step 6: 提交第一轮中性化**

Run:

```bash
git add -A
git commit -m "refactor: extract neutral b2b inquiry base"
```

Expected: 后续首笔实现提交只包含独立身份、业务减法、中性 reference site、通用询盘和对应证明；不包含 clean-room demo、generator 或自动同步。

## Phase 1 完成边界

本计划完成后只证明：

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```

仍未证明：三个 clean-room 派生、mutation proof、冷启动 Agent、真实 Cloudflare/Airtable/Resend acceptance、稳定 `v1.0.0` 或任何真实业务 `PUBLIC_LAUNCH_READY`。这些必须继续执行设计规格中的后续阶段。
