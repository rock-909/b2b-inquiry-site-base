# B2B Inquiry Site Base

B2B 询盘站模板，提供联系和询盘转化基础能力，内置英语/西班牙语多语言示例。

当前业务真相以本仓页面、内容、配置和上线证明为准。

## 当前站点范围

- 多语言示例：英语为默认语言，公开 URL 不带 `/en` 前缀；西班牙语使用 `/es/` 前缀。
- 未知页面或不存在的产品路径由 middleware 返回 404 时，保留已识别的语言前缀：例如 `/es/nope` 和 `/es/products/not-real` 显示西班牙语 404，导航和返回首页链接也保持西班牙语；没有已识别语言前缀的未知路径使用默认语言。
- 页面：Home、Contact、Privacy、Terms。
- 业务身份和页面内容必须由派生站 owner 在公开上线前替换确认。

模板默认保留可运行的公共页面和询盘链路；产品、服务和关于页由派生站按真实需求建立，不预先增加业务模型或产品/服务运行时 mode。

品牌与站点身份只有一份配置：`src/config/single-site.ts` 的 `SINGLE_SITE_CONFIG`。目前头部在配置 logo 后显示 logo，站点名出现在移动端导航菜单中；页脚始终显示「© 年份 公司名」（未填公司名时用站名），已填写的邮箱、电话、WhatsApp（国际格式，显示为 wa.me 链接）、地址和社交链接显示在页脚，联系卡显示已填写的邮箱、电话、WhatsApp 和地址，均与结构化数据同源。填写公司名才会生成 Organization JSON-LD，未配置时不输出组织引用。哪些字段可省略、格式校验和占位值拦截见[派生项目交接的设计与内容继承边界](docs/派生项目交接.md#设计与内容继承边界)。公开域名、真实邮箱、部署资源与询盘运行安全配置仍须在上线前完成；法务骨架默认不索引。

## 快速开始

环境要求：Node 24（版本见 `.node-version`）、pnpm 11（版本见 `package.json`，建议先执行 `corepack enable`）。

```bash
pnpm install
cp .env.example .env.local        # Next.js 本地开发环境变量
pnpm dev
```

本地设计保留示例中的服务密钥为空即可，无需创建 Cloudflare、邮件或 CRM 资源；未配置 Turnstile 时表单显示不可用状态，不能据此验证真实提交。首次提交前运行 `pnpm hooks:install`（每个 worktree 一次）。只有验证本地 Worker 时才复制 `.dev.vars.example` 为 `.dev.vars`。

真实询盘验证再配置独立测试服务或明确授权的真实服务：`AIRTABLE_API_KEY`、`RESEND_API_KEY`、`TURNSTILE_SECRET_KEY` 等服务端配置，以及公开的 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`。完整键位以 `.env.example` 为准；生产双通道交付、安全配置和上线证明见 [派生项目交接](docs/派生项目交接.md)。

联系页在无 JavaScript 时显示静态说明，配置有效公开邮箱后提供邮件入口。移动导航或语言菜单的按需加载失败时，移动导航保留普通链接，语言菜单改用当前页面的语言链接。需要重新加载交互功能时，请刷新页面。

真实人机验证脚本加载失败，或等待超时仍未渲染控件时，表单会显示加载失败提示和邮件联系入口；未获得验证令牌时，提交按钮仍保持禁用，不会自动放行。已渲染、正在等待买家完成的交互式挑战不会触发此加载超时提示；若控件稍后验证成功，提示会消失，表单可继续提交。

提交请求进行中，姓名、邮箱和留言暂时只读，避免等待期间补写的未发送内容在成功后被清空。请求结束后恢复编辑；成功时清空已提交的字段和这次提交的本地草稿，失败时保留输入供修改或重试。请求进行中离开联系页、回来后写下的新草稿，不会被这次提交迟到的成功清掉。

启用系统强制颜色模式（如 Windows 高对比度主题）时，键盘焦点保留可见轮廓，下拉菜单的当前高亮项也有轮廓指示，不只依赖阴影或背景色。

## 常用命令

```bash
pnpm dev
pnpm content:check
pnpm type-check
pnpm test
pnpm website:check
pnpm website:build:cf
```

完整 CI 检查见[质量门禁](docs/质量门禁.md)。

## 主要维护入口

| 要做的事 | 阅读入口 |
| --- | --- |
| 了解项目用途和边界 | [项目](docs/项目.md) |
| 开发、升级或排查技术限制 | [技术栈](docs/技术栈.md) → [技术债](docs/技术债.md) |
| 选择检查、准备 PR 或发布 | [质量门禁](docs/质量门禁.md) |
| 理解建站方法、底座位置与后续工作 | [派生站工作流](docs/派生站工作流.md) |
| 创建、fork 或接手派生站 | [派生项目交接](docs/派生项目交接.md) |
| 调整视觉或比较参考 | [设计真相](docs/design/设计真相.md) → 按任务查[设计参考](docs/design/设计参考.md) |

派生站研究从 [派生站工作流](docs/派生站工作流.md) 开始；换肤、组件结构和单页设计的入口见 `.claude/rules/ui.md` 的 Design tokens；换主色步骤（含询盘通知邮件的 sRGB 快照）见[派生项目交接的第一轮替换](docs/派生项目交接.md#第一轮替换)。

创建、fork 或接手派生站时，从 [派生项目交接](docs/派生项目交接.md) 开始；不要继承模板或另一个站点的 provider、部署和 Owner 证据。

## 技术基础

当前技术栈、精确版本、Cloudflare、cache、CSP 和升级边界见 [技术栈](docs/技术栈.md) 与 `package.json`。

## 当前内容和配置真相

- 品牌事实、页面正文、SEO / crawl、导航和 UI 文案的编写入口：见 `.claude/rules/content.md` 的 Authoring sources；首页普通联系链接使用现有路径配置

修改 locale message pack 后运行 `pnpm content:check`。消息叶子值必须是字符串，允许有意义的空字符串；数字、布尔值、`null` 和数组会使检查失败，并输出对应语言文件和消息路径。

消息文件原样使用，不做站点占位符替换；站点名等配置值由调用处直接读取 `SINGLE_SITE_CONFIG`。翻译中的调用参数（如 `{language}`）由翻译调用方提供。

## AI 协作入口

- Codex：`AGENTS.md`
- Claude：`CLAUDE.md`

项目事实写入 docs 或规则文件；通用工作方法使用全局 skills。
