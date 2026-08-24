# B2B Inquiry Site Base

英文 B2B 询盘站模板，面向 offering 介绍、联系和报价询盘转化。

当前业务真相以本仓页面、内容、配置和上线证明为准。多 profile runtime 和 materialize 工具已经退役；旧说明需要追溯时看 Git 历史。

## 当前站点范围

- 单语言：English only，公开 URL 不带 `/en` 前缀。
- 页面：Home、Products、About、Contact、Privacy、Terms。
- 业务身份、offering 和页面内容必须由派生站 owner 在公开上线前替换确认。

模板内置的是询盘、安全和交付基础能力。产品目录、服务目录或混合 offering 页面属于派生站的业务内容层：多数 B2B 站都会增加这些页面，但不需要在模板核心里预置固定目录模型或运行时 mode。

## 快速开始

环境要求：Node 24（版本见 `.node-version`）、pnpm 11（版本见 `package.json`，建议先执行 `corepack enable`）。

```bash
pnpm install
cp .env.example .env.local        # Next.js 本地开发环境变量
cp .dev.vars.example .dev.vars    # Cloudflare 本地预览环境变量
pnpm dev
```

询盘表单需要在 `.env.local` 里填入真实服务配置。服务端密钥包括 `AIRTABLE_API_KEY`、`RESEND_API_KEY` 和 `TURNSTILE_SECRET_KEY`；`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是浏览器侧公开站点 key。完整键位以 `.env.example` 为准，派生和上线见 `docs/派生项目交接.md`。

## 常用命令

```bash
pnpm dev
pnpm content:check
pnpm type-check
pnpm test
pnpm website:check
pnpm website:build:cf
```

CI 当前保留类型、lint、测试、Dependency Cruiser、Playwright smoke、Semgrep 和 Cloudflare/OpenNext build proof。

## 主要维护入口

1. `docs/项目.md`
2. `docs/架构与行为.md`
3. `docs/派生项目交接.md`
4. `docs/技术栈.md`
5. `docs/design/设计真相.md`

派生站整体换肤从 `src/app/theme.css` 开始；组件结构和 variant 看 `docs/design/组件治理.md` 与 `src/components/ui/*`；单页特殊设计直接改对应页面或领域组件。

创建、fork 或接手派生站时，从 `docs/派生项目交接.md` 开始；不要继承模板或另一个站点的 provider、部署和 Owner 证据。

## 技术基础

当前技术栈、精确版本、Cloudflare、cache、CSP 和升级边界见 `docs/技术栈.md` 与 `package.json`。

## 当前内容和配置真相

- 品牌事实：`src/config/single-site.ts`
- SEO / crawl：`src/config/single-site-seo.ts`
- 导航和链接：`src/config/single-site-navigation.ts`、`src/config/single-site-links.ts`
- 页面正文：`src/content/pages/en/*.ts`
- Offering 数据：`src/config/offerings.ts`
- UI 文案 authoring truth：`messages/base/**`、`messages/profiles/b2b-lead/**`

message graph 固定为 `base -> b2b-lead`。修改 physical packs 后运行 `pnpm content:check`。

## AI 协作入口

- Codex：`AGENTS.md`
- Claude：`CLAUDE.md`

项目事实写入 docs 或规则文件；通用工作方法使用全局 skills。
