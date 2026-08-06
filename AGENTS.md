# AGENTS.md

Tucsenberg 防洪挡板英文 B2B 官网，使用 Next.js App Router 和
Cloudflare/OpenNext，服务产品发现、PDF 下载和 OEM / 批发询盘。

## 已知约束

- `pnpm build`、`pnpm website:build:cf` 和 Playwright webServer 共用
  `.next`，不得并行运行。

## Rules

`.claude/rules/*.md` 的 `paths:` 是适用范围的权威；下表供其他编码工具查找。

| 范围 | Rule |
| --- | --- |
| TypeScript、命名、import、复杂度、lint | `coding-standards.md` |
| 路由、layout、metadata、缓存、client 边界 | `conventions.md` |
| 组件、页面 UI、Tailwind、设计 token | `ui.md` |
| 测试、fixture、mock、行为证明 | `testing.md` |
| API、安全配置、lead schema、Next 配置 | `security.md` |
| middleware、OpenNext、Wrangler、部署 | `cloudflare.md` |
| 内容、messages、站点配置、内容查询 | `content.md` |
| 翻译 key、locale 路由、i18n 管道 | `i18n.md` |
| JSON-LD、FAQ schema、SEO 组件 | `structured-data.md` |

## 验证

- 上线工作按 `docs/正式上线标准.md` 分层验证；`pnpm release:verify`
  只证明 release lane，不等于正式部署或业务上线。

## 依赖文档

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
