# B2B Inquiry Site Base

B2B 询盘站模板，面向 offering 介绍、联系和报价询盘转化，内置英语/西班牙语多语言示例。

当前业务真相以本仓页面、内容、配置和上线证明为准。多 profile runtime 和 materialize 工具已经退役；旧说明需要追溯时看 Git 历史。

## 当前站点范围

- 多语言示例：英语为默认语言，公开 URL 不带 `/en` 前缀；西班牙语使用 `/es/` 前缀。
- 未知页面或不存在的产品路径由 proxy 返回 404 时，保留已识别的语言前缀：例如 `/es/nope` 和 `/es/products/not-real` 显示西班牙语 404，导航和返回首页链接也保持西班牙语；没有已识别语言前缀的未知路径使用默认语言。
- 页面：Home、Products、About、Contact、Privacy、Terms。
- 业务身份、offering 和页面内容必须由派生站 owner 在公开上线前替换确认。

模板默认包含基础产品目录、产品详情和询盘链路。派生站可以保留、扩展，或在完成依赖清理和门禁验证后移除，不预先增加产品/服务运行时 mode。

## 快速开始

环境要求：Node 24（版本见 `.node-version`）、pnpm 11（版本见 `package.json`，建议先执行 `corepack enable`）。

```bash
pnpm install
pnpm hooks:install                # 启用本地 Git hook（每个 worktree 一次）
cp .env.example .env.local        # Next.js 本地开发环境变量
cp .dev.vars.example .dev.vars    # Cloudflare 本地预览环境变量
pnpm dev
```

询盘表单需要在 `.env.local` 里填入真实服务配置。服务端密钥包括 `AIRTABLE_API_KEY`、`RESEND_API_KEY` 和 `TURNSTILE_SECRET_KEY`；`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是浏览器侧公开站点 key。完整键位以 `.env.example` 为准，派生和上线见 `docs/派生项目交接.md`。

首页询盘表单、移动导航或语言菜单的按需加载失败时，页面仍会保留：询盘区显示静态联系说明（配置了有效公开邮箱时提供邮件入口），移动导航保留普通链接，语言菜单改用当前页面的语言链接。需要重新加载交互功能时，请刷新页面。

真实人机验证脚本加载失败，或等待超时仍未渲染控件时，表单会显示加载失败提示和邮件联系入口；未获得验证令牌时，提交按钮仍保持禁用，不会自动放行。已渲染、正在等待买家完成的交互式挑战不会触发此加载超时提示；若控件稍后验证成功，提示会消失，表单可继续提交。

提交请求进行中，姓名、邮箱和留言暂时只读，避免等待期间补写的未发送内容在成功后被清空。请求结束后恢复编辑；成功时清空已提交的字段和本地草稿，失败时保留输入供修改或重试。

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
2. `docs/技术栈.md`
3. `docs/质量门禁.md`
4. `docs/派生站工作流.md`
5. `docs/派生项目交接.md`
6. `docs/design/设计真相.md`

派生站研究从 `docs/派生站工作流.md` 开始；整体换肤从 `src/app/theme.css` 开始；组件结构和 variant 看 `.claude/rules/ui.md` 与 `src/components/ui/*`；单页特殊设计直接改对应页面或领域组件。

创建、fork 或接手派生站时，从 `docs/派生项目交接.md` 开始；不要继承模板或另一个站点的 provider、部署和 Owner 证据。

## 技术基础

当前技术栈、精确版本、Cloudflare、cache、CSP 和升级边界见 `docs/技术栈.md` 与 `package.json`。

## 当前内容和配置真相

- 品牌事实：`src/config/single-site.ts`
- SEO / crawl：`src/config/single-site-seo.ts`
- 导航和链接：`src/config/single-site-navigation.ts`、`src/config/single-site-links.ts`
- 页面正文：`src/content/pages/{locale}/*.ts`
- Offering 数据：`src/config/offerings.ts`
- UI 文案 authoring truth：`messages/base/{locale}/messages.json`

修改 locale message pack 后运行 `pnpm content:check`。消息叶子值必须是字符串，允许有意义的空字符串；数字、布尔值、`null` 和数组会使检查失败，并输出对应语言文件和消息路径。

## AI 协作入口

- Codex：`AGENTS.md`
- Claude：`CLAUDE.md`

项目事实写入 docs 或规则文件；通用工作方法使用全局 skills。
