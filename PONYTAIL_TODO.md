# Ponytail 整改待办总表

> 形成日期：2026-08-18。本文只汇总已经审查和裁决的待办；详细证据见
> `PONYTAIL_AUDIT.md`。完成一项后更新状态，不再从历史审查段落重新推断结论。

## 已锁定的边界

### 必须保留

- 邮件为日常询盘主通道，Airtable 为结构化备份；
- 字段校验、请求体限制、honeypot、服务端 Turnstile、Upstash、PII 保护；
- 同一 `referenceId` 串联买家结果、邮件、Airtable 和日志；
- 任一交付渠道成功即可接受、两者都失败才让买家重试；
- 真实 Airtable canary，但只在将来显式提供真实部署和凭据时运行；
- next-intl、locale 路由和后续多语言能力；
- NavigationProgressBar、dark/system theme 和主题切换；
- Vercel/Cloudflare 双部署、OpenNext、R2、Cache Components、Partial Prefetching；
- 产品 slug 的稳定 HTTP 404 预检；
- 串行 release 技术检查和正式上线证明分层。

### 明确不做

- 不把 Airtable 改成日常主通道；
- 不新增队列、消息总线、数据库、自动重试或幂等框架；
- 不新增 provider interface/factory；
- 不把 `forbiddenOutput` 再加入 release manifest；
- 不删除多语言、进度条或深色模式；
- 不把本地/CI 绿灯写成正式上线；
- 不处理当前 UI/token 迁移修改；
- 暂不处理 main branch protection；
- 当前阶段不配置真实 Airtable/Resend 凭据，不真实部署。

## 2026-08-18 合并审查回补

- [x] 删除未使用的 `gray-matter` 和 3 个未使用 export，`pnpm knip:check` 通过；
- [x] 修正询盘 30 秒预算说明：服务端已知最坏耗时为 20 秒，约留 10 秒余量；
- [x] 回补 P0-1、P1-11 和 P1-12 的证明缺口；
- [x] 第五批技术待办已完成；Owner/真实上线待办仍与本地和 CI 证明分开。

## 第一批：修复会“假通过”或职责混乱的检查

### P0-1 拆分 Airtable canary 与普通测试

- [x] 增加独立的真实 canary 命令，不再让普通 Playwright 套件承担真实 provider 证明；
- [x] 普通本地测试、PR CI、`pnpm release:verify` 在无真实凭据时正常运行；
- [x] 只有显式启动真实 canary 时才检查部署地址和 Airtable 凭据；
- [x] 显式启动但缺少前置条件时，一次性列出缺失项并非零退出；
- [x] 删除 canary 中“全部 `test.skip()` 后仍成功”的路径；
- [x] 外部 URL 模式不得启动本地 Playwright webServer；
- [x] canary 继续验证真实表单提交、Airtable 字段和 `referenceId`；
- [x] canary 测试记录删除失败时也要明确报告，不能静默留下垃圾记录。

完成标准：默认本地/CI 不需要真实凭据；显式 canary 缺条件会红，条件齐全时才可能绿。

状态：已完成（2026-08-18，审查回补）。canary 现在读取 `/api/inquiry` 响应中的 `data.referenceId`，并与 Airtable 的 `Reference ID` 严格比较。缺前置条件的本地边界测试通过；真实 provider 未配置，未运行真实 canary。

### P0-2 重做部署后快速巡检的路由清单

- [x] 保留部署命令输出的 `workers.dev` 地址作为本次 Worker 诊断地址；
- [x] 自动检查首页、`/products`、一个真实 offering 详情；
- [x] 从 `OFFERINGS` 读取真实 slug，不维护第二份手写清单；
- [x] 自动检查一个不存在 offering 的 HTTP 404；
- [x] 保留联系页、询价页、健康接口和安全文本检查；
- [x] 保留明显占位域名的静态配置拦截；
- [x] 删除“自动 smoke 已证明 DNS/TLS/custom domain”的描述和断言。

完成标准：自动巡检证明本次部署的核心页面和路由；域名、DNS、TLS 不再被冒充为自动证明。

状态：已完成（2026-08-18）。本地真实 Next runtime 的 deployed smoke 已覆盖产品主链和未知 offering 404；未进行真实 Cloudflare 部署。

### P0-3 重新写清发布和上线分工

- [x] 本地开发：只负责改动相关类型、lint、测试和必要构建；
- [x] PR CI：负责完整测试、Chromium、Next/OpenNext 构建和安全扫描；
- [x] `release:verify`：只负责当前 SHA 的本地 release 技术序列；
- [x] 部署 workflow：负责真实部署和部署 URL 巡检；
- [x] 真实 Airtable canary、Resend provider 状态、owner 收件回执分别记录；
- [x] 正式域名、DNS、TLS、联系信息、法务和最终批准由上线负责人人工确认；
- [x] 同步 `docs/正式上线标准.md`、`docs/开发与维护.md` 和命令输出。

状态：已完成（2026-08-18）。文档、workflow 总结和 `release:verify` 结束输出已使用同一证明边界。

## 第二批：询盘代码和测试收口

### P1-1 明确 Resend 与 Airtable 的最终职责

- [x] 将 `email-first-storage-optional` 改为准确的“email primary / Airtable backup”语义；
- [x] 保持当前 Resend-first 串行顺序；
- [x] 保持邮件失败时 Airtable Message 带通知失败提示；
- [x] 保持邮件成功/Airtable 失败仍返回成功；
- [x] 保持邮件失败/Airtable 成功仍返回成功；
- [x] 保持两个 provider 都失败才返回失败；
- [x] 不增加 Airtable 更新接口、队列或重试系统。

完成标准：代码、日志、测试和文档对“邮件主通道、Airtable 备份”使用同一种说法。

状态：已完成（2026-08-18）。运行时 policy、失败日志、规则、技术文档和相关测试已统一。

### P1-2 收窄询盘生产接口

- [x] 删除与 `emailSent` 完全重复的 `ownerNotified`；
- [x] 删除只有测试调用的 `AirtableService.isReady()`；
- [x] 评估并内联合理的 `airtable/instance.ts`、`resend-instance.ts` 单行包装；
- [x] 保留 provider timeout、返回 id 校验、字段清洗和无密钥泄漏日志；
- [x] 不改变 buyer-visible 成功/失败语义。

状态：已完成（2026-08-18）。两个单例包装已移入系统 Trash，服务实例直接由唯一生产调用方持有。

### P1-3 建立 inquiry 测试覆盖归属表

- [x] route 测试只负责 HTTP 状态、校验顺序、honeypot 和错误映射；
- [x] process-lead 测试只负责两个渠道的顺序和失败语义；
- [x] provider adapter 测试只负责 HTTP payload、响应、超时和清洗；
- [x] 进程内整链测试负责 route 到 provider adapter 的真实代码连接；
- [x] 真实 canary 只负责真实部署和真实 Airtable；
- [x] Resend owner receipt 只负责真实邮件送达。

状态：已完成（2026-08-18）。覆盖归属表已写入 `docs/开发与维护.md`。

### P1-4 删除和合并重复 inquiry 测试

- [x] 将 `lead-pipeline-real.test.ts` 改成准确的 in-process 命名和说明；
- [x] 把 `lead-family-contract.test.ts` 的独有响应断言并入 route 测试；
- [x] 把 `lead-family-protection.test.ts` 的独有保护断言并入 route/安全测试；
- [x] 移除两组 `lead-family` 重复文件；
- [x] 将 `canonical-inquiry-contract.test.ts` 与 process-lead/整链测试重复部分合并；
- [x] 保留 schema、PII、公式前缀、Unicode、空 provider receipt 等独有失败保护。

完成标准：同一个交付失败分支不再由五套测试重复维护，每个测试名与实际证明范围一致。

状态：已完成（2026-08-18）。三份重复测试已移入系统 Trash；全量 Vitest 199 files / 1427 tests 通过。

### P1-5 收窄 mock-heavy layout 测试

- [x] 保留非法 locale、font class 和必要 layout shell 测试；
- [x] 删除与 header/footer/theme/cookie/messages/metadata 专属测试重复的断言；
- [x] 不再为少量 layout 断言维护约 21 个 module mock；
- [x] 保留浏览器/no-JS 对真实页面组合的验证。

状态：已完成（2026-08-18）。layout 单测从 21 个外围 mock 收窄为 5 个直接边界 mock，真实组合继续由现有浏览器/no-JS 测试负责。

## 第三批：安全与表单外围简化

### P1-6 收窄 Upstash 限流实现

- [x] 保留生产 Upstash 和原子 `increment()`；
- [x] 删除 `RateLimitStore.get()`、`delete()`、`MemoryRateLimitStore.cleanup()`；
- [x] 删除只有一个业务入口却设计成通用系统的 preset/factory/wrapper；
- [x] 删除不控制运行时的 `ALLOW_MEMORY_RATE_LIMIT` 墓碑及相关文档/测试；
- [x] 保持真实超限返回 429、存储故障返回 503；
- [x] 暂时保持 `10 次/分钟/IP`；
- [x] 将 Upstash 5 秒超时收窄到约 1.5--2 秒，并保留 timeout 行为测试；
- [x] 不增加生产内存 fallback，除非以后真实故障记录证明需要。

状态：已完成（2026-08-18）。生产仍使用 Upstash 原子 `INCR` 且故障 fail-closed；本地仅保留进程内 Map，Upstash timeout 收窄为 2 秒。删除通用 preset/factory/HOF/CORS 包装和测试专用 store API，route 测试直接钉住 429/503。

### P1-7 简化 Lazy Turnstile

- [x] 保留真实 widget、服务端验证、test mode、token reset 和失败救援文案；
- [x] 删除 idle/intersection 双重延迟；
- [x] 删除不必要的 placeholder/rescue 状态和重复协调测试；
- [x] 验证真实询价页上 widget 可及时使用，失败后仍能重试。

状态：已完成（2026-08-18）。询价表单直接渲染 `TurnstileWidget`，删除 lazy/Suspense、idle/IntersectionObserver、placeholder、15 秒计时状态和两组协调测试；明确失败仍显示邮件救援，成功重试会收回提示，test mode 与 reset 链保持不变。

### P1-8 Cookie、GA 和 UTM 保留但空配置不打扰

- [x] 保留 GA 同意、UTM first-touch 和未来派生接入点；
- [x] 没有 GA、广告参数或实际归因 consumer 时不显示完整偏好弹层；
- [x] 只有实际配置的用途才出现在文案和偏好界面；
- [x] 收窄没有真实投放用途的 click-id 字段；
- [x] 简化 Context、external store、lazy island 和手写 focus trap 的重叠；
- [x] 需要 modal 时复用现有 Base UI，不重新实现焦点管理。

状态：已完成（2026-08-18）。无 GA 时不渲染 consent/analytics；有 GA 时只显示 Analytics Accept/Reject；UTM first-touch 保留，click-id 和 marketing 分类删除。通过类型、lint、React Doctor、全量 Vitest、普通 Next build、7 条本地生产模式 Playwright 和 Cloudflare/OpenNext build。

## 第四批：多语言、内容和客户端边界

### P1-9 保留多语言，删除固定消息组合协议

- [x] 保留 next-intl、locale 路由、消息文件、翻译检查和 SEO/no-JS 验证；
- [x] 合并固定 `base -> b2b-lead` 消息组合；
- [x] 删除递归 merge、pack registry、leaf ownership 等无实际选择的协议；
- [x] 删除重复 parity/contract 测试；
- [x] 保证派生站增加一个 locale 时仍有清楚的单一路径。

状态：已完成（2026-08-18）。保留 `next-intl`、locale routing 和 client namespace pick；将固定两层消息合为 `messages/base/{locale}/messages.json`，删除 runtime merge、pack registry、ownership/parity 专项测试，并通过 `pnpm content:check`、类型、lint、React Doctor、全量 Vitest、普通 Next build、7 条本地生产模式 Playwright 和 Cloudflare/OpenNext build。

### P1-10 删除 Client Boundary 手工文件账本

- [x] 删除 exact `"use client"` 文件名单和 stale/unexpected 清单维护；
- [x] 删除只证明名单同步的测试；
- [x] 保留普通 build 后基于真实 chunk/source map 的产物检查；
- [x] 重新核对产物阈值只保护可复现的 bundle 回归。

状态：已完成（2026-08-18）。删除源码 client-boundary budget、名单同步检查和重复测试；保留 InquiryForm 真实 `.next` chunk/source map、禁用依赖和 raw/gzip 阈值检查。通过 focused Vitest、类型、lint、React Doctor、全量 Vitest（190 files / 1233 tests）、普通 Next build、client-boundary 产物检查、7 条本地生产模式 Playwright 和 Cloudflare/OpenNext build。

### P2-1 用一次构建实验裁决内容 manifest

- [x] 在隔离变更中将四个固定页面改成直接静态导入的 MDX/TSX/TS 内容；
- [x] 串行验证普通 Next build 和 Cloudflare/OpenNext build；
- [x] 验证 metadata、sitemap、404、legal TOC 和 no-JS；
- [x] 若直接导入成立，删除 generated manifest、freshness gate、query wrapper 和重复测试；
- [x] 若 Cloudflare 确实需要生成副本，只保留一个生成文件和一个 freshness 检查。

状态：已完成（2026-08-18）。四个固定页面改为 `src/content/pages/en/*.ts` 直接静态导入；Next 与 OpenNext 均可打包，无需 generated manifest、内容 freshness gate 或 query wrapper。旧 MDX、manifest/slug/readiness CLI 及只保护它们的测试已移入系统 Trash。通过类型、lint、React Doctor、全量 Vitest（184 files / 1167 tests）、普通 Next build、Cloudflare/OpenNext build、8 条生产模式 Playwright 和 6 条 no-JS Playwright；未进行真实部署或 provider 验证。

### P1-11 收窄页面登记表和 content-slugs

- [x] 保留导航、sitemap、SEO、smoke 共用的一份小型页面清单；
- [x] 删除单语言 `localizedPaths: {en: ...}`；
- [x] 删除只供测试查文件的 `routeOwner`；
- [x] 删除多层 freeze/map/wrapper；
- [x] 删除 `content-slugs.js` 无正式调用者的 `--json`、`--quiet` 和 report writer；
- [x] 若内容 manifest 被删除，继续删除失去用途的 content CLI/gate。

状态：已完成（2026-08-18，审查回补）。`PUBLIC_STATIC_PAGE_DEFINITIONS` 同时登记路由和静态内容 slug；`page-dates.ts` 直接从该清单派生，不再手写第二份映射，生产函数、错误和日志也已去掉过期的 MDX 命名。focused 3 files / 8 tests、类型和 lint 通过。

## 第五批：UI、测试垃圾和配套层

### P2-2 验证原生移动菜单能否替代复杂 Sheet

- [x] 使用现有 `<details>/<summary>` 做同环境浏览器验证；
- [x] 验证键盘、焦点、滚动、关闭行为、布局和无 JS；
- [x] 原生实现未满足要求，不删除 lazy interactive drawer 和 Sheet 包装；
- [x] 存在明确浏览器反例，保留当前交互实现并记录原因。

状态：已完成（2026-08-18，验证后保留）。仓库安装的 Chromium 对同结构原生菜单实测：`Enter` 可打开，但 `Escape` 不关闭，焦点仍留在 `summary`；打开后页面可继续滚动，Tab 可离开菜单进入背景内容，点击链接也不会自行收起持久 header 中的 `<details>`。现有无 JS Playwright 已证明 fallback 可用，现有 Sheet Playwright 则覆盖 Escape、焦点约束和恢复、滚动锁、背景关闭及路由后关闭。原生方案缺少这些必要行为，保留当前最小 client island 和 Base UI Sheet；focused 6 files / 44 tests 通过。

### P1-12 清理历史测试 fixture

- [x] 将当前发现的 12 个测试专用临时 Trash 目录整体移入系统 Trash；
- [x] 记录清理前 17,200 KiB、15,721 个子项，清理后项目专用 `/tmp/*test-trash` 为 0；
- [x] 不触碰其他用户或系统临时文件；
- [x] 修改相关测试，只清理由本次测试创建且仍位于预期 temp root 的目录；
- [x] 不再把项目专用 `/tmp` Trash 当长期存储。

状态：已完成（2026-08-18）。12 个历史根目录已移入 `~/.Trash/b2b-inquiry-test-trash-20260818-131853`。7 组仍在运行的 fixture 测试共用一个有 temp root 和名称前缀校验的系统 Trash helper；focused 7 files / 104 tests、复跑合计 11 files / 114 tests、测试类型检查和 lint 通过，复跑后未重新生成项目专用 `/tmp/*test-trash`。

### P1-13 修正 production-config 测试假站点

- [x] 删除 checker 内 Vitest 专用 Showcase 假配置；
- [x] checker 接收显式 fixture 输入；
- [x] 单测验证 fixture 的正反例；
- [x] 真实仓库配置由独立 CLI/integration proof 读取；
- [x] 保留生产密钥、占位域名、联系信息和安全开关的真实阻断。

状态：已完成（2026-08-18）。生产 checker 不再根据 `VITEST` 返回内置 Showcase 配置；单测显式传入站点事实和独立 `wrangler.jsonc` fixture，覆盖 owner-ready 正例与非上线 URL/模板内容反例。真实 CLI 仍读取当前仓库配置并保留 sentinel 与环境阻断。focused 1 file / 36 tests、测试类型检查和 lint 通过。

### P1-14 合并 release manifest 与 runner

- [x] 将 release 步骤收敛成 runner 内一个普通步骤数组；
- [x] 删除 deepFreeze、clone、getter、sequence 多层派生；
- [x] 删除只验证数组 clone、命令字符串和文件路径同步的测试；
- [x] 保留首个失败立即退出、端口占用和 artifact budget 解析测试；
- [x] 保持共享 `.next` 的 build/Playwright/OpenNext 串行约束。

状态：已完成（2026-08-18）。release 步骤和人工 proof lane 直接位于 `release-verify.js`；独立 manifest、clone/getter/sequence 与其同步测试已移入系统 Trash。保留 runner 失败传播、端口占用、gzip 预算和 Playwright → Next build → OpenNext build → artifact checks → Wrangler dry-run 顺序证明。focused 3 files / 16 tests、测试类型检查、lint 和 Knip 通过。

### P1-15 去掉 release 中第二份测试文件注册表

- [x] 删除 focused lead-family/health/proxy/i18n 文件清单；
- [x] 避免 `proxy-locale-cookie.test.ts` 等文件在同一 release 中重复执行；
- [x] 使用一次真实 `pnpm test`，或者明确依赖同一 exact-SHA PR CI；
- [x] 不再由 release manifest 手工追踪新增测试文件。

状态：已完成（2026-08-18）。release runner 只保留一个 `pnpm test` 步骤，不再登记具体测试文件，也不重复执行 proxy/i18n/health/inquiry 子集。runner focused 3 files / 14 tests 通过；真实 `pnpm test` 为 183 files / 1159 tests 全部通过。

### P1-16 收窄本地 Git 门禁

- [x] pre-commit 只保留 staged format 和真正便宜、相关的检查；
- [x] 不在每次 commit 全仓 type-check + lint；
- [x] pre-push 保留 type-check、测试和必要 build；
- [x] Cloudflare build、Semgrep、浏览器矩阵、Knip、dependency audit 交给 CI/release/定时任务；
- [x] 删除或弱化 `RUN_FAST_PUSH` 周围的大段绕过协议和重复说明；
- [x] commit-msg 约定式提交保持不变。

状态：已完成（2026-08-18）。pre-commit 只保留 staged Prettier 和相关变更触发的翻译检查；pre-push 串行执行生产/测试类型检查、一次全量测试和必要的 Next/client-boundary build。删除本地 dependency-cruiser、audit、Knip 与 `RUN_FAST_PUSH` 协议，commitlint 不变。focused 1 file / 8 tests 通过。

### P2-3 收窄 CI 和定时任务频率

- [x] PR 保留 type/lint/test、Chromium、Next/OpenNext build、artifact/header 和 Semgrep；
- [x] Firefox/WebKit/mobile 矩阵从每日改为每周或发布前手动；
- [x] weekly dependency audit 保留；
- [x] workflow contract 只保护真实 false-green、secret/shell 和失败传播风险；
- [x] 删除只测试 action 名称、步骤位置或历史字符串的断言。

状态：已完成（2026-08-18）。PR CI 的必需门禁不变；全浏览器矩阵改为每周一和手动运行，workflow/test 文件及环境开关统一改为 weekly/full-coverage 命名，零重试 flake sampling 保留。weekly dependency audit 保留；相关 contract 改用真实命令、环境、失败传播和产物顺序定位，不再依赖 action 显示名。focused 7 files / 29 tests、生产/测试类型检查、lint 和 Knip 通过。

### P1-17 激进清理剩余配套层

- [x] 删除或准确改名不读取官方数据的 `cloudflare-official-compare.js`；
- [x] 删除无正式调用者的 CLI 参数和 report writer；
- [x] 删除单调用方无状态薄包装和重复 config/navigation 转发层；
- [x] 删除只断言旧文件、旧函数、alias 或墓碑继续不存在的测试；
- [x] 修复 `docs/README.md` 的失效链接；
- [x] 清理 `docs/superpowers/specs/**` 等已失效过程文档，删除文件时移入系统 Trash；
- [x] 修正 `.claude/rules/security.md`、`docs/项目.md`、`docs/开发与维护.md` 与当前运行态漂移；
- [x] 全仓搜索 Showcase、donor、旧环境开关和过期 proof 文案。

状态：已完成（2026-08-18）。Cloudflare 检查准确改名为 `cloudflare-config-check.js`，删除无行为差异的 `--source-only`；删除 footer/navigation/home-link 的重复映射、getter 和转发文件，并去掉只守这些别名/源码形状的测试。修复 docs 索引，`docs/superpowers/**` 与失效测试移入系统 Trash；静态内容、FAQ、proxy、honeypot reference id 和 weekly/full-coverage 文案已同步到代码、rules 和 docs。全仓旧语义搜索只剩 production-config 的 Showcase sentinel 及其负例 fixture，以及 hook contract 对已删除 `RUN_FAST_PUSH` 的负断言。focused 20 files / 153 tests、生产/测试类型检查、lint 和 Knip 通过。

### P1-18 保留进度条和主题，但收窄外围

- [x] NavigationProgressBar 保留；
- [x] dark/system theme、ThemeProvider、ThemeSwitcher 保留；
- [x] 删除它们周围没有真实 consumer 的重复状态、薄包装和重复测试；
- [x] 保留 reduced-motion、键盘可用性和主题 hydration 行为。

状态：已完成（2026-08-18）。进度条实现和 reduced-motion/路由行为测试原样保留。layout 直接使用 `next-themes` 的 ThemeProvider，删除单调用方转发组件；ThemeSwitcher 将服务端 skeleton 与 hydration 后 UI 合并为一棵 DOM，删除 handler/data-testid 包装和 3 条源码形状/测试专用断言，保留 light/dark/system、键盘按钮语义、`aria-pressed`、resolved theme 和 SSR hydration 证明。focused 3 files / 13 tests、生产/测试类型检查、lint 和 Knip 通过。

## Owner/派生站交接

状态：已从本次清理待办移出。真实 Airtable、Resend、部署、域名、Owner 上线和仓库治理清单由 `docs/派生项目交接.md` 持续维护，并在每个派生项目中重新核对；不再作为 Ponytail 技术实施待办重复跟踪。

## 每批验证顺序

1. 最窄相关 Vitest/脚本测试；
2. `pnpm type-check`；
3. `pnpm type-check:tests`；
4. `pnpm lint:check`；
5. 必要时 `pnpm test`；
6. 涉及页面或 Client Component 时运行相关 Chromium/React Doctor；
7. `pnpm build`；
8. 紧跟普通 build 的真实 client artifact 检查；
9. `pnpm website:build:cf`；
10. 最后串行运行 `pnpm release:verify`。

`pnpm build`、`pnpm website:build:cf` 和 Playwright webServer 共用 `.next`，始终串行。

## 文件清理规则

- 所有仓库文件删除先移入系统 Trash；
- 禁止 `rm`、`rmdir`、`unlink`、`find -delete`、`git clean`；
- 历史测试临时目录只处理已确认的项目专用路径；
- 不触碰 `unified_inbox.json`，它不是本轮创建的文件；
- 不处理当前 UI/token 迁移修改。
