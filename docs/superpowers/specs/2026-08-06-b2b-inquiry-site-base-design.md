# B2B Inquiry Site Base 设计规格

## 结论

从 `/Users/Data/code/tucsenberg-site` 的已验证 tracked snapshot 建立一个完全独立的普通单站仓库：

```text
/Users/Data/workspace/B2B Inquiry Site Base
```

仓库显示名为 `B2B Inquiry Site Base`，package/repository 标识使用 `b2b-inquiry-site-base`。它只服务一种窄合同：英文 B2B 产品或服务发现、SEO、核心内容页和询盘转化。

模板必须先脱离 Tucsenberg，并在真实业务进入前完成自身打磨。首个真实业务是稳定模板的消费者，不承担模板架构清理、测试裁剪或基础设施首次试验。

## 来源与独立性

- 正式实施 donor：`/Users/Data/code/tucsenberg-site` 当前干净 `main`。
- 本轮固定 SHA：`dcb9e2bbed164b484e1c8cbc1b08c7f140e84405`。
- 只复制 tracked files，不复制 `.git`、`.next`、`node_modules`、环境密钥或构建产物。
- 新仓不继承 Tucsenberg Git 历史和 remote。
- 新仓先保留一笔原样 donor snapshot commit，再通过独立提交做中性化。
- 后续与 Tucsenberg 独立演进；新业务只从稳定 tag 创建，不自动同步。

## 当前技术基线

第一轮保留 donor 的完整运行技术线，避免同时重写业务边界和平台边界：

- Next.js `16.3.0`；
- React `19.2.8`；
- TypeScript 7 CLI `7.0.2` + TypeScript 6 工具链 `6.0.2`；
- Cache Components / Partial Prefetching；
- OpenNext 固定 commit `69807b1`；
- Cloudflare Workers / Wrangler；
- R2 incremental cache；
- Turnstile、Airtable、Resend 和现有询盘防丢语义。

这些版本是当前 exact-tag 的起点，不是永久标准。模板候选发布前必须重新 live 复核上游状态；若正式稳定版本已覆盖当前临时补丁，在模板仓完成迁移和全量重验，不把升级实验分散给各业务站。

## 模板承诺

模板提供：

- 单一 B2B 企业站；
- 产品或服务 offerings；
- 首页、About、Contact、Request Quote、Privacy、Terms 和 404；
- metadata、robots、sitemap、JSON-LD 与基础可访问性；
- general inquiry 和 offering-specific inquiry；
- 固定 Cloudflare + R2 + Turnstile + Airtable + Resend 路线；
- strict production sentinel、工程验证、Cloudflare 构建和 release proof；
- 明确的派生修改地图。

新业务预期修改：

- 品牌、公司和业务事实；
- offerings；
- 页面、前端组件、视觉和 design tokens；
- `content/**`、`messages/**`、`public/**`；
- 导航、SEO 和公开联系方式；
- Worker、R2、域名和环境配置值。

新业务原则上不修改：

- `src/app/api/inquiry/**`；
- `src/lib/lead-pipeline/**` 的公共处理语义；
- Turnstile、CORS、honeypot、限流；
- Airtable、Resend、日志脱敏；
- OpenNext/Cloudflare 构建逻辑；
- release runner 和公共测试基础设施。

## 明确不建设

- CMS、电商、会员、后台或多租户；
- profile、materializer 或 generator；
- 页面启停 feature flags 或 schema-driven page engine；
- 动态表单搭建器；
- provider interface/factory；
- monorepo、共享 npm 包或自动同步；
- 产品型、服务型等运行时 mode；
- 为旧 Tucsenberg 命名保留兼容层；
- 推测性组件、测试和治理门禁。

## 第一轮中性化

### 保留

- Next/OpenNext/Cloudflare/TS 双轨和 R2 基础设施；
- 通用 layout、locale、metadata、robots、sitemap、404 和内容管道；
- `/api/inquiry` 与安全、校验、限流、Turnstile、日志、Airtable、Resend；
- attribution、cookie、monitoring 等仍在真实询盘路径上使用的能力；
- 能证明询盘、安全、Cloudflare 和 release 行为的最小测试。

### 移出

- 防洪产品、产品目录、产品详情、指南、OEM、warranty；
- Tucsenberg 图片、PDF、favicon 和业务文案；
- 产品计算器、图示和专属 UI；
- catalog message pack；
- Tucsenberg 专属 stories、Storybook estate 和 component governance registry；
- 对应的专属测试、探针和发布门禁；
- 旧 starter/profile/materializer 残余。

所有文件移除都移动到 macOS Trash，不永久删除。

### 中性询盘合同

第一版公共字段：

```text
fullName
email
message?
interest?
offeringId?
attribution fields
website honeypot
turnstile token
```

支持 general inquiry 和 offering-specific inquiry。删除 `catalogProductId`、`productInquiryKind`、`productName` 等产品强耦合，不添加兼容 alias，也不建设动态表单系统。

询盘处理继续保持：owner email 先执行，Airtable 随后写入并记录邮件结果；任一渠道成功即对买家成功，两边都失败才返回失败；日志不得泄露完整买家自由文本或 secret。

## 模板成熟生命周期

1. 固定 donor 并记录干净安装、测试、Next/OpenNext 构建证据。
2. 建立独立仓并完成减法和中性化。
3. 模板自身普通开发、测试和构建变绿；sentinel 状态下 `PUBLIC_LAUNCH_STRICT` 必须红且指出修改位置。
4. 从同一候选 tag 做三个一次性 clean-room 派生：产品目录、纯服务、标准 offering + custom request。
5. 派生如需修改禁止区域，回模板修根因，发布新 tag 后重新派生。
6. 对 sentinel、路由、询盘字段、Turnstile、provider 容错、日志、OpenNext pin、R2 binding、artifact 和失败传播做 `绿 -> mutation 红 -> 恢复绿`。
7. 由未参与提炼的冷启动 Agent 只读候选 tag、brief 和派生说明完成一次派生。
8. 使用模板维护者控制的非业务 Cloudflare、R2、Turnstile、Airtable QA 和 Resend 测试 inbox 部署产品型和服务型派生。
9. 验证 exact SHA receipt、路由/404、headers、assets、no-JS、表单、Airtable、Resend、R2 MISS/HIT、并发健康和 Worker 回滚。
10. 三个场景通过、连续两个场景无新结构性问题、独立复审无 blocker 后发布稳定 `v1.0.0`。

三个合成派生不做 profile、不长期维护。只保留 brief、diff 和结果，临时目录完成后移动到 Trash。

## 状态边界

第一轮结束只能称为：

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```

全部成熟生命周期完成后才可称为：

```text
READY_AS_TEMPLATE_FOR_FIRST_BUSINESS
```

任何模板状态都不等于某个真实业务的：

```text
PUBLIC_LAUNCH_READY
```

真实业务仍必须提供并证明自己的公司事实、内容和法务、正式域名、生产 provider 配置、DNS/sender 验证、owner 收件回执和业务上线确认。

