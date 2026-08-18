# Ponytail Ultra 审查记录

> 这是阶段性审查记录，不是项目运行真相或正式上线证明。代码、运行态、部署结果和
> `docs/正式上线标准.md` 优先于本文。修复完成后应删除已关闭的过程性内容，不把本文
> 演变成新的治理账本。
>
> 已裁决待办的唯一汇总入口：`PONYTAIL_TODO.md`。

## 审查基线

- 日期：2026-08-18
- 分支：`main`
- `HEAD`：`285296810d5206dfb5d14803e3d2f8af9f8fee4d`
- `origin/main`：`285296810d5206dfb5d14803e3d2f8af9f8fee4d`
- ahead / behind：`0 / 0`
- 开始审查时工作树：clean
- 范围：生产代码、测试代码、脚本、配置、CI、文档和发布证明
- 本轮未运行共享 `.next` 的 build、完整 Vitest 或 Playwright；结论来自静态调用链、
  配置、测试入口和已存在的运行证据。

## 判定原则

审查只保护业务结果，不保护当前实现方式：

- 买家能看到正确内容并提交询盘；
- 询盘可靠到达 owner，失败不能被静默伪装为成功；
- 滥用受到控制，PII 不泄露；
- 可访问性、SEO 和 404 语义正确；
- Vercel 与 Cloudflare/OpenNext 部署可用；
- release proof 和正式上线证明不能假绿。

`Knip`、文件大小、调用者少、CI green、测试失败或违反当前内部规则，均不能单独证明
某段代码应该保留或删除。每个删除候选都要追到真实 consumer、删除后果和最小替代。

## 首轮结论

### 1. `FALSE_GREEN`：Airtable canary 可以全部跳过后返回成功

正式 canary 命令明确设置 `POST_DEPLOY_TEST=1`，但测试在 Airtable 凭据缺失时调用
`test.skip()`。Playwright 在所有测试都被跳过时仍可能以成功状态退出，因此“启动了
canary”不等于“证明了 Airtable 写入”。

证据：

- `scripts/quality/release-proof-manifest.js:174-179`
- `tests/e2e/smoke/post-deploy-form.spec.ts:151-171`

同一命令只设置 `PLAYWRIGHT_BASE_URL` 时，Playwright 仍会启动本地
`pnpm build && pnpm start`；当前只有 `STAGING_URL` 会关闭 webServer。因此 deployed
canary 还可能无意义地构建一份本地站点。

- `playwright.config.ts:34-37`
- `playwright.config.ts:123-165`

最小方向：正式 canary 缺 URL 或凭据时直接失败；外部 URL 模式不启动本地 webServer。

### 2. `FALSE_GREEN / DRIFT`：production workflow 只 smoke `workers.dev`

Cloudflare production deploy 从命令输出提取最后一个 `*.workers.dev` 地址，并把它传给
部署后 smoke。该检查可以证明 Worker 地址可访问，但不能证明正式公开域名的 DNS、TLS、
custom domain route 和当前部署绑定正确。

证据：

- `.github/workflows/cloudflare-deploy.yml:215-231`
- `.github/workflows/cloudflare-deploy.yml:282-332`
- `docs/正式上线标准.md:19-39`

最小方向：保留 Worker 地址作为部署诊断，同时用明确配置的真实生产域名完成 public
smoke；未提供真实域名时不得报告正式生产地址已验证。

### 3. `FALSE_GREEN`：部署 smoke 没覆盖产品浏览主链

运行态存在 `/products` 和 `/products/[slug]`，产品详情也进入 sitemap，但 Cloudflare
smoke 清单没有产品 index、真实产品详情或未知产品 404。产品目录是已确认的模板能力，
不是可忽略的 donor 残留。

证据：

- `scripts/quality/checks/cloudflare-smoke.js:15-51`
- `src/app/sitemap.ts:73-85`
- `src/app/sitemap.ts:112-114`
- `src/app/[locale]/products/page.tsx`
- `src/app/[locale]/products/[slug]/page.tsx`

最小方向：覆盖 `/products`、一个来自 `OFFERINGS` 的真实详情和一个未知 slug 的 HTTP
404；不要手写第二份产品 slug 账本。

### 4. `MERGE`：固定消息包被做成了可扩展组合系统

当前消息包永远只有 `base` 和 `b2b-lead`，但外围维护了 pack 配置、递归 merge、组合
消息、翻译检查、类型映射和多组 parity/contract tests。它为当前单一英文 B2B 模板提供
的收益尚不足以证明这套扩展协议的维护成本。

证据入口：

- `messages/message-packs.json`
- `src/lib/i18n/message-pack-config.ts`
- `src/lib/i18n/composed-messages.ts`
- `src/lib/merge-objects.ts`
- `scripts/quality/checks/translations.js`
- `src/types/next-intl.d.ts`

首轮最小方向：合并成单一 locale message 文件。下一轮继续零基挑战：只有英文且
`localePrefix: "never"` 时，是否还需要完整 next-intl 和 locale routing。

### 5. `SHRINK`：Client Boundary exact inventory 是手工账本

脚本和 JSON 预算要求所有 `"use client"` 文件名精确同步，并由大体量测试保护。这只能
证明文件清单没有漂移，不能证明浏览器 payload、hydration 成本或用户体验。

证据：

- `scripts/quality/checks/client-boundary.js:8-232`
- `scripts/quality/config/client-boundary-budget.json`
- `tests/unit/scripts/client-boundary-budget.test.ts:86-271`

最小方向：删除 exact inventory；保留 `client-boundary.js --build-artifacts` 这类基于真实
构建产物的检查，但继续审查其阈值是否真的阻止可复现回归。

### 6. `BUG`：测试 fixture 被移入临时 trash 后永久累积

多组测试使用 `mkdtemp` 创建 fixture，结束时又把它们移动到 `/tmp` 下的项目专用 trash，
但没有最终清理。这样既没有真正释放空间，也没有提供有用的可恢复价值。

主要入口：

- `tests/unit/scripts/content-readiness-check.test.ts`
- `tests/unit/scripts/client-boundary-budget.test.ts`
- `tests/unit/scripts/cloudflare-static-asset-headers.test.ts`
- `tests/unit/scripts/content-slug-sync.test.ts`
- `tests/unit/scripts/mdx-slug-sync.test.ts`

首轮观察到相关临时目录累计约 1001 个 fixture、约 6.5 MiB。该数字是时点观察，不是
永久阈值。

最小方向：测试结束时永久删除“本次测试自己创建且仍位于预期 temp root 内”的 fixture。
因为项目默认禁止永久删除，实施前需要 owner 对这个窄范围例外作明确授权。

### 7. `DELETE`：三组 inquiry 合同测试重复证明相同链路

以下测试主要重复 route、真实 pipeline、schema 和 process-lead 已覆盖的字段映射、保护
开关与 provider 行为：

- `tests/integration/api/lead-family-contract.test.ts`
- `tests/integration/api/lead-family-protection.test.ts`
- `src/lib/lead-pipeline/__tests__/canonical-inquiry-contract.test.ts`

更直接的行为 proof 已存在于：

- `src/app/api/inquiry/__tests__/route.test.ts`
- `tests/integration/api/lead-pipeline-real.test.ts`
- `src/lib/lead-pipeline/__tests__/process-lead.test.ts`
- inquiry schema 和 handoff tests

三组候选合计 425 行。删除前仍需逐项建立“相同失败模式、相同执行 lane、会阻断同一
pipeline”的覆盖表；不能只因测试名称相似就删除。

### 8. `SHRINK`：RateLimitStore 暴露生产代码不使用的 API

真实限流链只调用 `store.increment()`；`get()`、`delete()` 和
`MemoryRateLimitStore.cleanup()` 的调用来自 store 自身或专项单测。这些 API 扩大了实现
和测试面，却不服务生产行为。

证据：

- `src/lib/security/stores/rate-limit-store.ts`
- `src/lib/security/distributed-rate-limit.ts:55-88`
- `src/lib/security/__tests__/rate-limit-store.test.ts`

首轮最小方向：收窄为生产所需的 `increment()`。下一轮继续零基比较：低流量 B2B 站的
滥用模型是否值得把 Upstash 作为生产硬依赖，还是 Turnstile、平台保护和更小的应用限制
已经足够。

### 9. `FALSE_GREEN / SHRINK`：production-config 单测维护第二套假站点

Vitest 路径不会读取真实 `src/config/single-site.ts` 和
`src/config/public-trust.ts`，而是在 checker 内构造一套旧 Showcase 配置。因此大量单测
证明的是假配置与 checker 的自洽，不是当前模板身份。正式 strict CLI 子进程会读取真实
配置，所以 production gate 并非整体失效。

证据：

- `scripts/quality/checks/production-config.js:12-94`
- `tests/unit/scripts/validate-production-config.test.ts`

最小方向：让测试通过显式 fixture 输入验证 checker，真实配置用独立 CLI/integration
proof；不要把第二套站点身份藏在生产 checker 中。

### 10. `SHRINK / DRIFT`：配套层在保护历史结构而非最终结果

已确认的次级候选：

- `cloudflare-official-compare.js` 没有读取或比较官方数据，名称高估了证明能力；
- release manifest 有 `deepFreeze`、clone、getter、sequence 派生等多层只读包装；
- `src/__tests__/proxy-locale-cookie.test.ts` 在一次 release verify 中执行两次；
- `content-slugs.js` 的 `--json`、`--quiet` 和 report writer 没有正式调用者；
- 多个 config/navigation 文件只是单层转发；
- 多组测试只断言 retired 文件、函数名、alias 或 CLI 参数继续不存在；
- `docs/README.md` 链接到不存在的 `技术问题与决策.md`；
- docs 声称不保留过程计划，但仍有 `docs/superpowers/specs/**`；
- `.claude/rules/security.md` 和 `docs/项目.md` 存在与当前运行态不一致的描述。

这些候选需要在第二轮按真实调用链分成 `DELETE`、`SHRINK`、`DRIFT` 或 `KEEP`，不能
一次性按“配套层太多”整包删除。

## 已确认不作为删除目标的业务方向

以下只保护方向，不保护外围实现：

- Vercel / Cloudflare 双部署；
- OpenNext；
- R2 incremental cache；
- Cache Components / Partial Prefetching；
- 当前仍为上述组合提供必要兼容性的适配补丁；
- 已由 owner 选择的内置最小产品目录；
- 为避免 Cache Components 流式 `notFound()` 返回 HTTP 200 soft 404 的产品 slug 预检。

它们周围的 manifest、gate、重复测试、历史墓碑和文档仍可被挑战。

## 第二轮：零基审查入口

下一轮不再问“现有机制怎样缩小”，而先问：

> 对一个低流量、英文 B2B 询盘站，这套机制为什么需要存在？

审查顺序：

1. inquiry delivery：Airtable + Resend；
2. anti-abuse：Turnstile + Upstash + proxy/security；
3. next-intl + messages + locale；
4. Cookie Consent + GA + UTM client subsystem；
5. content manifest + page registry + SEO；
6. release proof + CI + workflow contract tests；
7. 其余 client islands。

每个子系统统一输出：

```text
业务目标
→ 当前机制
→ 真实 consumer
→ 整体删除后果
→ 最小替代
→ 所需验证
→ DELETE / NATIVE / SHRINK / MERGE / BUG / FALSE_GREEN / DRIFT / DECISION / KEEP / UNPROVEN
```

## 第二轮结论：零基审查

本轮不把现有 rules、tests 或历史 spec 当成保留理由。它们只能解释当前实现，不能替代
真实业务后果。以下仍是只读结论，尚未实施删除或迁移。

### A. Inquiry delivery：Airtable + Resend

#### `DECISION / UNPROVEN`：双渠道是否有价值，取决于 owner 是否真的使用 Airtable

业务目标：询盘不能因为单一 provider 故障而丢失，owner 能及时采取行动。

当前机制：Resend 先发送 owner 邮件，随后写 Airtable；任一成功就向买家返回成功，两者
都失败才返回 500。

真实 consumer：

- `src/app/api/inquiry/route.ts:207-213`
- `src/lib/lead-pipeline/process-lead.ts:142-180`
- `src/lib/resend-core.tsx`
- `src/lib/airtable/service.ts`

整体删除后果：

- 删除 Resend：询盘只进入 Airtable，不再主动提醒 owner；
- 删除 Airtable：邮件失败时没有第二份记录，买家只能看到失败后重试；
- 两者都保留：单个 provider 故障时仍有一条送达路径，但最坏 provider 等待由 5 秒与
  8 秒串行相加。

关键判断：Airtable 记录只有在 owner 确实查看、分派或收到独立提醒时才是业务备份。
仓库只能证明“写了一条记录”，不能证明 owner 会看到它。如果 owner 只处理邮箱，
Airtable 是一个没有值班人的备用仓；如果 Airtable 就是实际 CRM，双渠道有明确价值。

所需验证：真实 owner 工作流、Airtable 处理频率、Resend 失败记录、是否发生过依靠
Airtable 找回询盘。没有这些证据前，不应仅凭“两个 provider 更安全”永久保留，也不应
仅凭低流量删除。

#### `DRIFT`：运行时称 Airtable optional，production gate 却强制要求

`LEAD_DELIVERY_POLICY` 和历史设计把 Airtable 定义成可选存储，但 strict production
config、Cloudflare deploy secrets 和正式上线标准均要求 Airtable。

- `src/lib/lead-pipeline/process-lead.ts:29`
- `src/lib/airtable/service.ts:20-47`
- `scripts/quality/checks/production-config.js:310-327`
- `.github/workflows/cloudflare-deploy.yml:138-152`
- `docs/正式上线标准.md:25-39`

最小替代不是新增 provider 抽象，而是做一次 owner 决策：

- Airtable 是正式 CRM：删除“optional”叙述，继续强制；或
- Airtable 只是可选备份：production gate 只按当前交付政策要求实际启用的 provider。

#### `KEEP`：email-first 的串行顺序当前有具体原因

先等邮件结果，再把“邮件通知失败”写进 Airtable 的自由文本，可避免保存的线索看起来像
已经通知过 owner。并行发送虽然更快，但会丢掉这一状态，或需要再做一次 Airtable 更新，
反而更复杂。

在没有真实转化数据证明 13 秒 provider 上限伤害提交前，保留当前顺序比引入队列、重试
状态机或幂等协议更小。

#### `SHRINK`：交付结果和测试面仍可明显收窄

- `ownerNotified` 永远等于 `emailSent`，没有独立生产 consumer；
- `AirtableService.isReady()` 只有测试调用；
- `airtable/instance.ts` 和 `resend-instance.ts` 是单行 singleton 包装；
- provider/pipeline 专项测试约 1990 行，部分 failure matrix 已被真实 pipeline 测试重复。

最小方向：保留“两条通道、任一成功”的行为，只删除重复状态、测试专用 API、singleton
薄包装和重复 failure matrix。不要为了统一 provider 再新增 interface/factory。

### B. Anti-abuse：Turnstile + Upstash + route wrappers

#### `KEEP`：Turnstile、服务端校验、honeypot 和 PII 边界有真实用途

`/api/inquiry` 是公开写入口。删除服务端 Turnstile 校验或 honeypot 会直接扩大垃圾提交和
provider 消耗面；这不是可以用“项目流量小”推掉的保护。

关键入口：

- `src/app/api/inquiry/route.ts`
- `src/lib/security/lead-turnstile.ts`
- `src/lib/security/turnstile.ts`
- `src/lib/api/safe-parse-json.ts`
- `src/lib/security/rate-limit-key-strategies.ts`

#### `DECISION`：Upstash 的收益和故障半径需要重新裁决

Upstash 的真实收益不是“流行”，而是给 Vercel 和 Cloudflare 提供同一套跨实例 10 次/分钟
限制，并避免在 Redis 中保存原始 IP。仓库没有 Cloudflare WAF/Vercel Firewall 的共同
配置，因此删掉 Upstash 后没有同等的双平台共享限制。

但当前是 fail-closed：Upstash 超时、凭据错误或服务故障时，所有正常询盘在进入
Turnstile 和 provider 前直接返回 503。

- `src/lib/security/distributed-rate-limit.ts:55-89`
- `src/lib/security/stores/rate-limit-store.ts:307-333`
- `src/lib/api/with-rate-limit.ts`

这形成了一个真实取舍：

- 保留 fail-closed：更抗滥用，但新增一个能让全部询盘停摆的外部依赖；
- storage failure 时 fail-open：更重视询盘可用性，但攻击者可利用故障窗口；
- 改平台原生限制：Cloudflare 与 Vercel 要分别维护，双部署不再同构。

当前没有攻击记录、Upstash 可用性数据或表单故障数据，不能诚实地判定哪边收益更大。
实施前应由 owner 明确“安全优先还是询盘可用性优先”。

#### `SHRINK / MERGE`：当前实现远大于所需行为

- 生产链只需要 `increment()`；`get()`、`delete()`、`cleanup()` 是测试专用面；
- `RateLimitStore` 为两个实现维护了完整接口，但生产只有一个 Upstash 实现；
- `withRateLimit()`、`createCorsRateLimitedRoute()` 和 preset 系统目前只有 inquiry 一个
  生产 consumer；
- rate-limit 核心约 650 行，相关专项测试超过 1500 行。

最小方向：保留一个 route-facing `checkInquiryRateLimit()` 和一个 Upstash atomic increment，
本地使用最小 Map fallback；删除未使用 API、通用 preset/factory 叙述和重复测试。

`ALLOW_MEMORY_RATE_LIMIT` 当前不控制 runtime，只作为 production/release 的禁止项存在。
它是一个“设置了也不生效，但我们还要专门禁止你设置”的配置，建议 `DELETE`。

#### `SHRINK`：Lazy Turnstile 状态机超过实际需要

Turnstile 只出现在询盘页面，直接渲染第三方组件不会把它加载到全站。当前另有 idle、
intersection、placeholder、15 秒 rescue、lazy error boundary、test/bypass 状态和大量
协调测试。

- `src/components/forms/lazy-turnstile.tsx`：281 行
- `src/components/security/turnstile.tsx`：约 220 行
- 对应 lazy 测试：约 467 行

最小替代：保留真实 widget、test mode、token reset 和一条失败救援文案；删除 idle /
intersection 双重延迟和不必要的 lazy island。表单安全组件应优先尽快可用，而不是为了
未经测量的首屏收益延迟出现。

### C. next-intl、messages 和 locale routing

#### `DELETE`：当前英语单语言项目没有足够证据保留完整 i18n 架构

当前事实：

- locale 只有 `en`；
- `localePrefix` 永远是 `never`；
- locale detection 关闭；
- 没有生产代码使用 next-intl 的日期、数字或列表 formatter；
- `NEXT_LOCALE` cookie 没有真实语言选择器可驱动；
- 项目目标明确是英文 B2B 询盘站。

证据：

- `src/config/paths/locales-config.ts`
- `src/i18n/routing-config.ts`
- `src/i18n/request.ts`
- `src/i18n/routing.ts`
- `src/proxy.ts`

当前 next-intl 影响约 55 个生产/测试文件。外围还包括 `[locale]` 路由层、消息加载、
client message 裁剪、locale cookie、translation checker 和多组 parity/contract tests。

整体删除的业务后果：当前英文页面仍可工作；损失的是未来直接加第二语言的预制骨架，
而“未来可能”不足以让所有当前派生站持续承担成本。

最小替代：

- 路由回到普通 App Router 路径；
- `next/link` / `next/navigation` 直接使用；
- 买家文案放在一份静态 TS 对象或单一 JSON；
- 需要日期/数字格式时用平台 `Intl`；
- `src/proxy.ts` 只保留产品 slug HTTP 404 预检。

这是高收益但高触碰面的迁移，必须在隔离分支验证 route status、metadata、sitemap、
Cloudflare/OpenNext build、no-JS 和真实浏览器导航。它不是“顺手删依赖”。

#### `MERGE`：若暂时保留 next-intl，也应先删除 message-pack 协议

固定 `base -> b2b-lead` 没有运行时选择，直接合并成一份英文消息即可。递归 merge、pack
registry、leaf ownership contract 和相关 parity tests 不保护当前业务结果。

### D. Cookie Consent、GA 和 UTM

#### `BUG / DRIFT`：没有可选 tracker 时仍向每位访客显示偏好弹层

Cookie island 无条件挂在 layout。即使没有 GA measurement ID，普通 URL 也没有 UTM 或
click ID，banner 仍要求用户在 Analytics 与 Marketing 之间选择。此时唯一会新增的存储
反而是 consent 自己的 localStorage。

- `src/app/[locale]/layout.tsx:97-99`
- `src/components/cookie/cookie-consent-island.tsx`
- `src/components/cookie/cookie-banner.tsx`
- `src/components/monitoring/enterprise-analytics-island.tsx:29-71`

这不是法律结论，而是明确的产品配置漂移：UI 声称存在可选择的用途，运行态却可能没有
对应 consumer。

#### `DELETE`：Marketing 分类当前没有对应广告或个性化系统

代码中的 marketing consent 只控制 UTM/click ID 的 sessionStorage；没有广告、再营销或
个性化脚本。banner 文案却说用于 personalized content and advertisements。

最小方向：没有真实 marketing consumer 时删除该分类和相关文案。UTM/click ID 是否需要
单独同意属于 owner 的法律/业务决策，工程代码不能靠把它命名为 marketing 自动完成合规
判断。

#### `SHRINK`：Context + external store + lazy islands + 手写 focus trap 没有必要同时存在

当前子系统约 1246 行生产代码、1495 行专项测试，服务的真实 consumer 只有 banner、GA
开关和表单 attribution。

最小替代：

- 无 GA/attribution：整个 consent island 不渲染；
- 只有 GA：一个 `analytics: accepted | rejected` 状态和简单 Accept/Reject banner；
- 真有多个独立用途时才增加偏好面板；
- 非模态展开区域不需要手写 focus trap；若确实需要 modal，复用已安装的 Base UI Dialog；
- 不要把 consent UI 延迟到 idle 后突然出现，除非有真实性能对比证明收益大于交互跳变。

#### `SHRINK / DECISION`：UTM 跨页保存有业务价值，但当前协议过宽

跨页 first-touch attribution 可以帮助判断询盘来源，尤其买家从 landing page 浏览到 RFQ
后再提交。这个结果可以保留；不必同时保留 10 个字段、pending module state、多个 flush
事件和独立同意分类。

owner 应先确认实际投放平台和需要的字段。没有 Google/Meta/Microsoft 广告时，`gclid`、
`fbclid`、`msclkid` 与对应 Airtable 列都是 speculative surface。

### E. Content manifest、page registry 和 SEO

#### `DELETE`：四份静态 MDX 不值得维护 generated runtime manifest

当前只有 `about`、`contact`、`privacy`、`terms` 四份英文 MDX，却维护：

- manifest generator；
- generated TypeScript 内容副本；
- freshness gate；
- manifest lookup wrapper；
- query layer；
- 自定义 Markdown renderer；
- 约千行专项 tests/contracts。

证据入口：

- `content/pages/en/*.mdx`
- `scripts/quality/checks/content-manifest.js`
- `src/lib/content-manifest.generated.ts`
- `src/lib/content-manifest.ts`
- `src/lib/content-query/queries.ts`
- `src/lib/content/render-static-markdown-content.tsx`

生成 manifest 解决了 Cloudflare runtime 不能随意读本地文件的问题，但它不是唯一方案。
对四个固定页面，直接 TSX/静态 TS 内容模块更短，也不会产生需要 freshness gate 保护的
第二份生成内容。

最小替代：固定页面直接导入静态内容/metadata；如果未来出现大量内容或非开发者 CMS
需求，再恢复真正的内容构建管道。

#### `SHRINK / KEEP`：一个小型 page registry 有价值，当前字段和派生层过多

导航、sitemap、SEO 和 smoke 需要共享公开路由清单，因此完全删除 registry 会重新制造
多份手工列表。应保留一个紧凑的页面数组/record，但删除：

- 单语言下的 `localizedPaths: {en: ...}`；
- 只供测试验证文件存在的 `routeOwner`；
- 每次调用重新构造和 freeze 的派生 map；
- 与 messages/paths/SEO 之间的多层薄包装。

#### `SHRINK`：content-slugs 的 CLI 协议超过四份内容的需求

`content-slugs.js` 约 687 行，并带未使用的 `--json`、`--quiet` 和 report writer。保留真正
需要的 frontmatter/slug/日期/SEO 字段校验即可；若内容迁入 TSX，这整个 gate 可删除。

### F. Release proof、CI 和本地门禁

#### `KEEP`：一条串行 release 命令和 public-launch 分层是必要的

Next、Playwright 和 OpenNext 共用 `.next`，构建必须串行；Cloudflare artifact、header、
Wrangler dry-run、部署 smoke 与真实 provider receipt 也不能互相替代。保留一条明确的
`pnpm release:verify` 和 `docs/正式上线标准.md` 是有价值的。

#### `MERGE / DELETE`：manifest 的自我保护层远大于 runner

当前同一份步骤被 deep-freeze、clone 成多种形状、格式化成 sequence，再由多个测试验证
getter、路径、lane 和命令同步。

- `scripts/quality/release-proof-manifest.js`：257 行
- `scripts/quality/checks/release-verify.js`：202 行
- manifest/runner/CI workflow contract tests：超过 1200 行

最小替代：runner 内一个普通只读步骤数组，顺序执行并在首个失败处退出；单测只保留
runner 的失败传播、端口占用和 artifact budget 解析。文件存在、命令字符串和数组 clone
不需要各自成为永久合同。

#### `MERGE`：release 中点名多组 focused Vitest 不如一次真实测试入口

manifest 同时维护 lead-family、health、proxy、i18n、workflow 的文件清单，已经出现同一
测试执行两次。最小替代是一次 `pnpm test`，或明确依赖 exact-SHA CI；不要在 release
manifest 维护第二份测试文件注册表。

#### `SHRINK`：CI lane 有价值，但频率和重复证明可降低

- PR：保留 type/lint/test、Chromium E2E、Vercel/Next build、Cloudflare/OpenNext build、
  artifact/header proof 和安全扫描；
- scheduled browser matrix：Firefox/WebKit/mobile 有独特价值，但低变更模板未必需要
  每日运行，可改为每周或发布前手动；
- weekly dependency audit：独立于源码扫描，保留；
- workflow contract tests：只保护真实 false-green 风险，不测试 action 名称、步骤布局或
  历史字符串。

#### `SHRINK`：本地门禁把 CI 的大部分工作又跑了一遍

当前 pre-commit 全仓 type-check + lint，pre-push 再 build、content、production config、
client artifact、dependency-cruiser、audit、Knip。对于有 PR CI 的单人模板，这会显著增加
小改动反馈时间。

最小方向：

- pre-commit：只做 staged format 和真正便宜的检查；
- pre-push：type-check、相关/完整 tests，必要时 build；
- Cloudflare build、Semgrep、browser matrix、audit 和重型架构检查交给 CI/release；
- 不把 `RUN_FAST_PUSH=1` 这种可绕过本地 gate 描述成 merge 保护。

### G. 其余 Client Islands

#### `DELETE`：NavigationProgressBar 没有可测业务收益

该功能为一个装饰性顶部进度条维护 click capture、popstate、query/hash 判断、随机 trickle、
多个 timer 和 reduced-motion 分支：

- `src/components/navigation/navigation-progress-bar.tsx`：198 行
- 对应测试：334 行

Cache Components / Partial Prefetching 已经在改善导航等待。没有真实慢导航测量证明这条
动画提高转化或可理解性时，整体删除比继续修 edge case 更合理。

#### `NATIVE`：mobile menu 可以直接保留现有 `<details>` fallback

移动导航是必须的，但 Base UI Sheet、lazy activation、fallback 与 interactive drawer
同时存在不是必须。现有 `MobileNavigationFallback` 已经能在无 JS 下展示真实导航链接。

最小替代：把 `<details>/<summary>` 作为最终 mobile menu，删除仅服务该 drawer 的
`header-client.tsx`、`mobile-navigation-interactive.tsx` 和 `sheet.tsx`。只有真实浏览器证明
native menu 在目标设备上不能满足焦点、滚动或布局需求时，才恢复 drawer。

#### `DECISION / DELETE`：dark/system theme 不是当前 B2B 核心需求

品牌换肤入口 `theme.css` 有价值，但它不等于必须让访客切换 light/dark/system。当前没有
业务需求、转化证据或 accessibility 必要性要求这个开关。

若 owner 没有明确要求暗色模式，可删除 `next-themes`、`ThemeProvider`、`ThemeSwitcher`
和 `.dark` 运行分支，继续保留单一可换品牌的 light theme。若暗色模式属于明确设计目标，
则保留现状而不是重新手写主题状态。

## 第二轮总判定（初稿，以下方 owner 裁决为准）

在 owner 裁决前，高置信、可直接进入修复设计的方向：

- `DELETE`：固定 message-pack 组合协议（只删除组合层，不删除多语言基础设施）；
- `DELETE`：无 consumer 的 marketing consent 分类；
- `DELETE`：RateLimitStore 的 `get/delete/cleanup` 和 `ALLOW_MEMORY_RATE_LIMIT` 墓碑；
- `MERGE`：release manifest 与 runner；
- `SHRINK`：Cookie/GA/UTM、Lazy Turnstile、rate-limit wrappers、page registry、本地门禁；
- `NATIVE`：mobile menu 优先使用已经存在的 `<details>`。

`NavigationProgressBar` 和 dark/system theme 已被 owner 明确保留，不能按本节旧结论删除。

当时需要 owner 或同环境反例后才能实施的方向（现已部分裁决）：

- `DECISION`：Airtable 是正式 CRM 还是可选备份（已裁决：邮件为日常主通道，Airtable 为备份记录）；
- `DECISION`：Upstash fail-closed 是否符合“询盘不能丢”的优先级（已裁决：先保留并收窄风险）；
- `DECISION`：UTM/click ID 的真实投放和同意要求（已裁决：保留未来兼容，空配置不打扰）；
- `DECISION`：是否保留访客 dark/system theme（已裁决：保留）；
- `DELETE 候选`：完整 next-intl/locale routing（已裁决：不删除）；
- `DELETE 候选`：generated content manifest 和自定义 Markdown pipeline。

仍然保留的结果边界：询盘校验与送达、Turnstile、PII、可访问性、稳定 HTTP 404、
Vercel/Cloudflare 双部署、OpenNext/R2/Cache Components，以及不能假绿的正式上线证明。

## 用户裁决后的修订方向（2026-08-18）

本节记录 owner 对前两轮结论的裁决。它覆盖“是否值得存在”的问题，不等于已经完成
代码修改。后续实现仍需逐项走真实调用链和窄验证。

### 首轮十项

1. **Airtable 真实写入 canary：保留，而且必须保留。**
   这不是普通的接口测试，而是唯一能证明“真实部署的表单确实写入真实 Airtable”的
   业务验证。要修的是假通过：缺少目标地址或 Airtable 凭据时不能 `skip` 后返回成功，
   必须明确失败；测试产生的 canary 记录仍应按 reference/email 精确清理。

2. **自定义域名和 DNS：不再作为自动部署 smoke 的证明。**
   自动检查可以继续验证“这次部署输出的地址能访问”，但不能声称它证明了 DNS、TLS、
   custom domain route 或正式域名切换。正式域名、DNS、证书和最终跳转由上线负责人人工
   确认。`example.invalid`/`workers.dev` 的配置拦截可以保留为低成本防误配检查，但它
   不是网络层上线证明。

3. **产品部署主链：保留并纳入统一部署检查。**
   部署后至少检查首页、`/products`、一个真实 offering 详情、未知 offering 的 HTTP 404、
   联系/询价页和健康接口。不要再把“域名检查”和“产品功能检查”混成一个 gate。

4. **多语言和 locale：按模板目标保留。**
   后续派生站默认会做多语言，因此不删除 next-intl、locale 路由、语言消息文件或相关
   基础测试。原 finding 改为：只挑战固定 `base -> b2b-lead` 组合协议、重复 parity 测试
   和无实际选择的扩展层；每个派生站仍应能直接增加新语言。

5. **Client Boundary 账本：处理。**
   删除手工维护的文件清单，保留基于真实构建产物的检查；不再把“名单同步”当成 bundle
   或体验证明。

6. **测试临时 fixture：清理。**
   只清理由本次测试创建、仍位于预期临时目录内的 fixture；不清理历史目录，不把 Trash
   继续当作长期存储。实现前需要把这个窄范围清理写成明确的测试后置动作。

7. **重复 inquiry 合同测试：处理。**
   先做覆盖表，再合并重复测试；保留能证明真实 route、真实 pipeline、字段脱敏和 provider
   失败传播的那一组，不按文件名相似直接删除。

8. **RateLimitStore：收窄。**
   保留 Upstash 和 `increment()` 主链，删除生产没有调用的 `get/delete/cleanup`、通用
   preset/factory 叙述和无效的 `ALLOW_MEMORY_RATE_LIMIT` 墓碑；具体故障策略单列评估。

9. **production-config：处理。**
   checker 单测改用显式 fixture，真实站点身份由真实配置的 CLI/integration proof 负责，
   不再维护一套旧 Showcase 假站点。

10. **配套层：激进清理。**
    逐项移除历史墓碑、只转发的薄包装、没有正式调用者的 CLI 参数、重复 release/test
    注册表和漂移文档。保留真实业务、安全、部署和发布结果；不因“配套层很多”整包删除。

### 第二轮方向的补充裁决

#### 1. Airtable 与 Resend：保留“邮件主通道 + Airtable 备份记录”

owner 已确认日常会查看邮件，但不太可能每天查看 Airtable。这个实际工作习惯决定了
当前 **先发 Resend，再写 Airtable** 的顺序更合适，不应改成 Airtable-first。

最终分工：

```text
Resend：日常主通道，负责及时提醒 owner
Airtable：第二份结构化记录，负责在邮件失败时尽量保住询盘
referenceId：把买家结果、邮件、Airtable 和日志串起来
```

保留当前失败语义：

- Resend 成功、Airtable 失败：owner 已收到日常主通道通知，买家显示成功；
- Resend 失败、Airtable 成功：询盘没有完全丢失，Airtable Message 带通知失败提示；
- 两者都失败：返回失败，让买家重试。

这套方案的代价是：邮件失败后，Airtable 记录可能不能立即被 owner 发现。最小解决办法
不是增加队列或自建通知系统，而是在真实 Airtable 中配置一条简单自动提醒，或者规定低频
人工复核。是否启用由 owner 决定，代码不预建复杂状态机。

需要同步修正 `email-first-storage-optional` 的含糊说法，明确为“email primary / Airtable
backup”。真实 Airtable canary 继续保留，因为备份渠道只有实际写得进去才有价值；Resend
收件箱仍是独立证明，不能由 Airtable canary 代替。

#### 2. Upstash：保留，先收窄风险而不是换掉

建议先不改变“生产必须有共享限流”的大方向，优先做三件小事：

1. 把 Upstash 请求超时从 5 秒压到约 1.5--2 秒，避免外部服务慢时把正常询盘卡住很久；
2. 保持“真实超限返回 429、存储故障返回 503”的区分，监控两者数量，不把故障伪装成
   用户超限；
3. 先保留 fail-closed，不直接开放生产内存 fallback。若真实监控证明 Upstash 短暂故障
   会造成可接受性问题，再做一个有上限的紧急本地桶，并用故障演练决定是否启用，不能先
   加一个永远没人负责的开关。

当前 `10 次/分钟/IP` 暂不凭感觉改动。先用真实询盘量和误拦截记录决定是否调整为更宽的
“正常访客不受影响、脚本提交迅速受限”的窗口；Turnstile、honeypot、请求体大小限制和
PII 边界继续保留。

#### 3. 多语言：保留基础设施，删除无必要的组合协议

多语言是模板能力，不是当前项目的 speculative feature。保留 locale 路由、next-intl、
消息文件、翻译检查和 no-JS/SEO 相关验证；只把固定 pack 组合、重复 parity 测试和一次性
薄包装压缩成“每个 locale 一份可直接读取的消息对象”。新增语言仍只需增加一个 locale
文件和对应内容，不恢复被删掉的组合系统。

#### 4. Cookie/GA/UTM：按未来兼容保留，但不让空配置制造打扰

这部分属于未来兼容，不整体删除。保留 GA 同意、UTM first-touch 和后续派生接入点；但
没有 GA measurement ID、广告参数或实际归因消费者时，不应强行向普通访客弹出完整偏好面板。
先把“是否有真实 consumer”作为渲染条件，再收窄字段和文案，避免把未来兼容做成当前用户
必须承担的界面成本。

#### 5. 内容清单和页面登记：采用小站常见的简化方案

行业里小型 B2B 展示站通常采用“版本库里的 MDX/TSX 内容 + 一份页面登记表”，而不是
为四个固定页面维护一套完整 CMS、查询层、生成副本和多层 freshness gate。多语言需要的
是每个语言的内容文件，不等于需要复杂的内容协议。

建议保留：

- 原始内容文件；
- 一个供导航、sitemap、SEO 共用的小型页面清单；
- Cloudflare 构建确实需要的静态导入方式。

建议删除或合并：

- 只复制同一份内容的 generated manifest；
- 只有一个调用方的 query wrapper；
- `localizedPaths`、`routeOwner` 等当前没有业务消费者的字段；
- 没有正式调用者的 `--json`、`--quiet` 和 report writer。

这项要先用一次 Cloudflare/OpenNext 构建验证“直接静态导入是否可行”。如果运行时确实
需要构建产物副本，就保留生成步骤，但把它压缩成单一生成文件和一个 freshness 检查，
不再维护完整查询协议。

#### 6. 发布检查与 CI：分清谁负责什么，再删重复门禁

建议按下面的责任分工：

| 层级 | 负责内容 | 不负责的内容 |
| --- | --- | --- |
| 开发者本地 | 改动相关的类型、lint、测试；需要时跑普通/Cloudflare 构建 | 不在每次提交重复跑全部安全审计和浏览器矩阵 |
| PR CI | 完整测试、Chromium 冒烟、Next/Cloudflare 构建、真实安全扫描 | 不代替正式域名、真实 provider 和 owner 收件证明 |
| `release:verify` | 当前 SHA 的串行发布技术序列、产物/header、Wrangler dry-run | 不代替部署后验证和正式上线批准 |
| 部署后自动检查 | 本次部署输出 URL、产品主链、404、健康接口、静态安全文本 | 不证明 DNS/custom domain 已切换 |
| 上线负责人 | 域名/DNS/TLS、Resend 收件、Airtable owner 流程、法务和最终批准 | 不把本地绿灯写成正式上线 |

保留失败传播、串行构建、exact-SHA 和关键 artifact 反例测试；删除或合并以下重复：

- release manifest 维护的第二份 focused Vitest 文件清单；
- pre-commit/pre-push 对 CI 已完整证明的重型检查；
- 只检查 action 名称、步骤布局或历史字符串的 workflow contract；
- 每日浏览器矩阵和每次推送的重型审计（改为低频或发布前运行）。

#### 7. 部署检查：拆成自动证明与人工确认两层

自动层只证明机器能可靠复现的事情：

- 当前 SHA 的 Next.js 与 Cloudflare/OpenNext 构建成功；
- 本次部署输出的 URL 可访问；
- 首页、产品目录、真实产品详情、未知产品 404、询价页、健康接口和安全文本状态正确；
- 真实 Airtable canary 通过（独立业务验证 lane）。

人工层确认不能仅靠脚本诚实证明的事情：

- 正式域名、DNS、TLS、custom domain route 和跳转；
- Resend 实际送达与 owner 收件箱回执；
- Airtable owner 视图、字段和后续处理流程；
- 法务、联系信息、品牌内容和最终上线批准。

因此，问题二的“域名/DNS 自动检查”可以移出自动 smoke；问题三的“产品主链检查”不能
移除，而应并入自动部署 smoke 的统一路由矩阵。`release:verify` 仍只负责本地 release lane，
不吞并人工上线确认。

#### 8. Client islands：进度条和深色模式按 owner 要求保留

`NavigationProgressBar` 保留，理由是它承担导航等待期间的心理反馈；dark/system theme、
切换入口和现有品牌换肤入口也保留。后续只清理它们周围没有真实 consumer 的重复状态、
测试和薄包装，不再把“非核心业务”直接等同于“可以删除”。

## 下一步实施顺序

1. 先修发布/部署证明边界：Airtable canary 不得假跳过；部署 smoke 增加产品主链；域名/DNS
   改为人工确认；整理自动检查与人工检查清单。
2. 再做 inquiry 交付流程收口：把 Resend 明确为日常主通道、Airtable 明确为备份记录，
   删除含糊状态和重复测试，保留真实 canary。
3. 低风险清理波次：fixture 后置清理、重复 inquiry 测试、RateLimitStore 未用 API、真实
   production-config fixture、client-boundary 手工账本。
4. 最后激进处理配套层：release manifest/runner、无调用 CLI、历史墓碑、重复门禁和漂移文档；
   每组完成后只跑对应窄验证，再串行跑 release lane。

本轮仍未修改生产代码、测试或部署配置；只更新了这份审查记录。

## 进一步澄清：询盘交付的通盘审计与本地职责（2026-08-18）

### 审计边界

前两轮已经沿着当前代码的真实主链做了静态通盘审计：

```text
InquiryForm
→ /api/inquiry
→ rate limit
→ JSON/schema 校验
→ honeypot
→ Turnstile 服务端校验
→ processValidatedInquiry
→ Resend
→ Airtable
→ 买家收到 referenceId
```

这已经覆盖生产代码、调用关系、provider 封装、字段映射、失败分支、测试入口、发布脚本
和部署 workflow。尚未证明、也不可能在当前“没有真实凭据且不真实部署”的条件下证明的是：

- Resend 是否被 provider 接受并最终送达 owner 收件箱；
- Airtable 真实 base/table 是否接受生产字段；
- Cloudflare 真实部署后的表单是否能写入真实 Airtable；
- owner 是否真的在 Airtable 中管理询盘。

所以当前结论是：**代码层面的调用链成立；外部服务和业务流程的最终成立尚未证明。**

### 代码中已经存在的额外机制

当前不是简单的“发邮件 + 写表格”，还包括：

1. 公开接口先经过共享限流；
2. honeypot 命中时返回假成功，不触发 provider；
3. Turnstile 在服务端再次校验；
4. 服务器重新生成 `referenceId`，不信任浏览器传入的类型；
5. 姓名拆成 First Name / Last Name；
6. Airtable 字段做清洗，防止公式、控制字符和脏文本进入表格；
7. UTM/click ID 只写入允许的归因字段；
8. Resend 和 Airtable 使用不同的超时预算；
9. 不自动重试，不使用队列，不做重复询盘幂等；
10. 邮件失败时，会在 Airtable 的 Message 文本前加“通知失败”提示；
11. 两个渠道都失败才给买家返回失败；任一渠道成功就返回成功；
12. 真实 canary 会通过部署后的表单提交，再读取 Airtable 记录并删除测试记录。

其中第 11 条是当前最重要的业务语义：它保护“询盘尽量不丢”，但不等于两个渠道都成功，
也不等于 owner 已经看到邮件。`emailSent` 目前只能表示 Resend API 返回了 message id，
`ownerNotified` 实际上只是它的同义字段，不能证明收件箱送达。

### 目前代码实际采用的分工

| 部件 | 当前职责 | 当前不负责的事情 |
| --- | --- | --- |
| 浏览器表单 | 收集字段、展示 Turnstile、展示成功/失败 | 不决定最终类型，不直接写 Airtable/Resend |
| `/api/inquiry` | 限流、JSON 解析、字段校验、honeypot、Turnstile | 不保存询盘，不确认 provider 最终送达 |
| `process-lead.ts` | 生成 referenceId，协调两个 provider，决定成功语义 | 不做队列、重试、去重或人工分派 |
| Resend | 给 owner 发通知邮件，Reply-To 指向买家邮箱 | 不保存 CRM 主记录，不证明 owner 读过邮件 |
| Airtable | 写入结构化询盘记录，当前是第二通道 | 当前不返回通知状态，不做重试/去重 |
| release proof | 验证本地技术序列 | 不做真实 provider 送达和 owner 验收 |
| Airtable canary | 证明真实部署能写入真实 Airtable | 不证明 Resend 送达或正式域名 |
| 上线负责人 | 确认域名、收件箱、Airtable 工作流和业务内容 | 不由脚本自动代替判断 |

### 没有真实凭据时，应该怎样工作

现在需要明确区分四种运行方式，而不是让所有命令都试图连接真实服务：

#### 本地开发和普通测试

- 使用测试 Turnstile、mock Resend、mock Airtable；
- 不访问真实 Airtable；
- 不发送真实邮件；
- 可以证明字段和失败分支，但不能写成真实 provider 证明。

#### 本地 release 技术检查

`pnpm release:verify` 只跑类型、lint、测试、构建、Cloudflare 产物和 dry-run；不应该要求
真实 Airtable、真实 Resend 或真实部署地址。

#### 部署后页面检查

只检查本次部署地址的页面、产品路由、404、健康接口和安全文本；不提交询盘，不写真实
Airtable，不发送真实 Resend 邮件。

#### 真实业务 canary

只有显式执行 `POST_DEPLOY_TEST=1` 并同时提供真实部署地址、Airtable 凭据和目标表时才运行。
缺少任一条件时应一次性报出“canary 未执行：缺少哪些前置条件”，以非零状态退出，不能
`test.skip()` 后让整套 Playwright 显示绿色。

这意味着“本地没有真实 Airtable 凭据”不是错误；它只表示本地不能运行真实业务 canary。
真正的错误是：把未运行的 canary 报告成已通过，或者让普通本地测试被迫连接真实服务。

### Airtable 和 Resend 的最终流程裁决

当前代码是：

```text
先发 Resend
→ 再写 Airtable
→ 邮件失败时给 Airtable Message 加提示
```

owner 已确认日常查看邮件而不是 Airtable，因此不改成 Airtable-first。保留：

```text
先发 Resend 提醒 owner
→ 再写 Airtable 备份记录
→ 邮件失败但 Airtable 成功：记录带通知失败提示
→ 邮件成功但 Airtable 失败：owner 仍能从邮件处理询盘
→ 两者都失败：返回失败
```

第一版不新增队列、重试服务、幂等数据库或复杂状态机。Airtable 若需要更及时地发现
“邮件失败但记录成功”，优先使用 Airtable 自带自动提醒，而不是在网站代码中再造通知系统。

### 历史 fixture 清理范围

owner 已明确：问题六要处理历史累积，不只修未来测试。

当前临时目录中已发现 12 个项目测试专用 Trash 目录，合计约 5.6 MiB、约 1,345 个历史
fixture。实施时会：

- 只处理这些明确命名的项目测试 Trash 目录；
- 先整体移动到系统 Trash，保留恢复机会；
- 不触碰其他用户临时文件；
- 同时修改测试，让新 fixture 在测试结束后直接清理，不再持续累积。

## 测试 mock 使用的延伸审查（2026-08-18）

### 总体判断

mock 并不是 Airtable 独有，也不是整个测试库都存在同样问题。当前 215 个测试文件中：

- 76 个文件使用 `vi.mock()`；
- 6 个文件直接替换或注入 `fetch`；
- 4 个文件位于 `tests/integration`；
- 17 个文件名包含 `contract`。

这些数字本身不能说明测试有问题。真正的问题是：**部分测试 mock 掉了自己声称证明的
核心链路，或者用“real / integration / proof”命名扩大了证明范围。**

### 正常且应该保留的 mock

| 测试类型 | 为什么 mock 合理 |
| --- | --- |
| Airtable HTTP adapter 单测 | subject 就是请求格式、响应解析、超时和错误处理；不能让每次单测写真实表 |
| Resend HTTP client 单测 | subject 是请求 payload、message id、错误体和 timeout；不应发送真实邮件 |
| Upstash store 单测 | subject 是 Redis REST 协议解析；mock 网络可以稳定覆盖异常响应 |
| Cloudflare smoke checker 单测 | subject 是 checker 如何判断不同 HTTP 响应；真实网络由部署命令负责 |
| 小型组件单测 | mock router/translation/provider 可以隔离组件自身交互 |

这些测试的问题不在 mock，而在于必须配有更高一层真实入口验证。当前 Airtable 有手动
真实 canary，Cloudflare smoke 有真实命令入口，这个分层方向是正确的。

### 已确认需要处理的 mock 问题

#### 1. `lead-pipeline-real.test.ts` 名字过度承诺

该测试确实运行了真实 route、schema、Turnstile 代码、Resend client、Airtable writer 和
失败语义，但把 Turnstile、Resend、Airtable 三个 HTTP 服务全部替换成一个 `fetchMock`。

因此它是有价值的 **进程内整链集成测试**，不是“真实端到端 provider proof”。建议保留
主体，改名和说明，不再使用 `real end-to-end proof`；真实 provider 只由 canary/收件箱
证明。

#### 2. 两组 `lead-family` integration 测试 mock 掉了大部分核心链路

`lead-family-contract.test.ts` 和 `lead-family-protection.test.ts` 同时 mock：

- rate limit；
- Turnstile；
- `processValidatedInquiry`；
- inquiry schema。

它们自己注释里也承认只验证响应形状和外围顺序。这类测试可以存在，但没有理由放在
integration 目录并与 `route.test.ts` 重复。建议把少量独有断言合并进 route 测试，其余删除。

#### 3. inquiry 测试存在多层重复

当前相同字段映射、任一渠道成功、referenceId 和失败分支分散在：

- route test；
- process-lead test；
- canonical contract；
- lead-family contract/protection；
- in-process pipeline test。

目标不是删掉所有 mock，而是明确每层只证明一件事：

```text
route test：HTTP 状态、校验顺序、错误映射
process-lead test：两个渠道的协调和失败语义
provider adapter test：真实 HTTP 请求/响应协议
in-process pipeline test：route 到 provider adapter 的完整代码连接
real canary：真实部署和真实 Airtable
owner receipt：真实邮件送达
```

同一失败语义不再在五层各写一遍。

#### 4. `layout.test.tsx` 是明显的 mock-heavy 候选

该文件为 4 个测试维护约 21 个 module mock，包括 next-intl、metadata、structured data、
header、footer、theme、cookie、navigation 和 messages。它更像手工重建一个假 layout，
维护成本高，而且真实组件连接断开。

建议只保留 layout 自己拥有的非法 locale、font class 和必要 shell 行为；其余交给已有的
专属组件测试、消息测试、metadata 测试和浏览器/no-JS 测试。不要再增加 layout mock。

### 测试精简后的原则

不是“尽量少用 mock”，而是：

> 单元测试可以 mock 外部边界，但名字不能声称证明真实服务；integration/proof 测试不能
> mock 掉它所声称证明的核心行为。

建议处理顺序：

1. 先画 inquiry 五层覆盖表；
2. 把 `lead-pipeline-real` 改成准确的 in-process 命名；
3. 合并两组 `lead-family` 辅助测试；
4. 合并 `canonical-inquiry-contract` 与 `process-lead` 重复部分；
5. 收窄 mock-heavy layout 测试；
6. 保留 Airtable/Resend/Upstash adapter 的 fetch mock 单测；
7. 保留独立真实 Airtable canary 和 Resend owner receipt。
