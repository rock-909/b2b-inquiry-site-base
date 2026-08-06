# Tucsenberg Site

Tucsenberg 英文官网项目，面向海外防洪屏障采购、OEM/批发询盘和资料下载转化。

这个仓库已经从 `showcase-website-starter` 派生成具体站点。当前业务真相以 Tucsenberg 页面、内容、配置和上线证明为准。多 profile runtime 和 materialize 工具已经退役；旧说明需要追溯时看 Git 历史。

## 当前站点范围

- 单语言：English only，公开 URL 不带 `/en` 前缀。
- 页面：Home、Products、5 个产品详情页、OEM/Wholesale、2 个 Guide、About、Request Quote、Contact、Warranty、Privacy、Terms。
- 产品线：
  - ABS flood barriers
  - Aluminum flood gates
  - Absorbent flood bags
  - Flood tube dams
  - FRP flood barriers
- 下载件在 `public/downloads/**`，PDF 响应需要保持 `X-Robots-Tag: noindex`。

## 快速开始

环境要求：Node 24（版本见 `.node-version`）、pnpm 11（版本见 `package.json`，建议先执行 `corepack enable`）。

```bash
pnpm install
cp .env.example .env.local        # Next.js 本地开发环境变量
cp .dev.vars.example .dev.vars    # Cloudflare 本地预览环境变量
pnpm dev
```

询盘、联系表单和 RFQ 页面需要在 `.env.local` 里填入真实服务配置。服务端密钥包括 `AIRTABLE_API_KEY`、`RESEND_API_KEY` 和 `TURNSTILE_SECRET_KEY`；`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是浏览器侧公开站点 key。`AIRTABLE_BASE_ID` 等完整键位以 `.env.example` 为准；获取与配置方式见 `docs/开发与维护.md`。

## 常用命令

```bash
pnpm dev
pnpm content:check
pnpm component:check
pnpm website:check
pnpm website:build:cf
```

CI 当前保留 React Doctor、Tucsenberg Playwright smoke、Component governance、Dependency cruiser、Semgrep 和 Cloudflare/OpenNext build proof。

## 主要维护入口

1. `docs/README.md`
2. `docs/项目.md`
3. `docs/架构与行为.md`
4. `docs/开发与维护.md`
5. `docs/正式上线标准.md`
6. `docs/技术问题与决策.md`

历史 starter 派生说明已经退出当前文档入口；需要追溯时看 Git 历史，不要把它们当 Tucsenberg 当前站的业务入口。

## 技术基础

当前技术栈、精确版本、Cloudflare、cache、CSP 和升级边界见 `docs/技术栈.md` 与 `package.json`。

## 当前内容和配置真相

- 品牌事实：`src/config/single-site.ts`
- SEO / crawl：`src/config/single-site-seo.ts`
- 页面表达：`src/config/single-site-page-expression.ts`
- 导航和链接：`src/config/single-site-navigation.ts`、`src/config/single-site-links.ts`
- 页面正文：`content/pages/en/*.mdx`
- 产品数据：`src/constants/tucsenberg-product-page-*.ts`、`src/constants/tucsenberg-product-pages.ts`、`src/config/single-site-product-catalog.ts`
- UI 文案 authoring truth：`messages/base/**`、`messages/profiles/b2b-lead/**`、`messages/profiles/catalog/**`

message graph 固定为 `base -> b2b-lead -> catalog`。修改 physical packs 后运行 `pnpm content:check`。

## AI 协作入口

- Codex：`AGENTS.md`
- Claude：`CLAUDE.md`

长期规则写入 docs 或规则文件；不要只留在聊天、handoff 或旧 plan。
