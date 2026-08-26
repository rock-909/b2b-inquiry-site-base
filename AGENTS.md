# AGENTS.md

这是一个英文 B2B 询盘站模板，使用 Next.js App Router 和
Cloudflare/OpenNext，支持 offering 展示、联系和报价询盘转化。

## 默认实现策略

- 默认选择满足当前明确需求的最小改动；能不改代码就不改，能复用现有实现就不新增层。
- 新增依赖、抽象、配置、环境变量、兼容层、gate、脚本或文档前，必须指出当前真实消费者和可复现失败；说不清时不增加。
- 不为单一调用方提前设计通用框架。只有出现第二个真实调用方，且两者具有相同语义和变化轴时，才考虑抽象。
- 收益很小、未经测量，或需要长期维护私有补丁时，默认停止优化；安全、数据完整性、可访问性、询盘交付和发布真实性边界除外。
- 测试只保护用户可见行为、业务契约或已证明的回归风险，不为实现细节、文件形状、名称和假想未来增加 contract。
- 明确需求完成且最窄验证通过后立即停止；不顺手重构、不扩大范围、不把可选改进变成当前任务。

## 执行节奏

- 普通任务默认直接执行：读取适用规则、目标实现及直接调用方后开始修改，不主动升级为全面摸排、长期规划或多阶段审计。
- 只调查会影响当前方案选择、正确性或验收结果的不确定性；没有可复现失败、当前消费者或明确合同支撑的风险，不继续展开。
- 默认采用一次实现、一次最窄验证的闭环；验证通过后立即停止，不主动追加交叉复核、预防性补丁、总结文档或后续治理。
- 不为证明“没有遗漏”而扩大读取、搜索和验证范围。非阻塞发现最多简短报告，不转化为当前任务。
- 只有用户明确要求全面审计、生产加固、迁移验证或高风险复核时，才扩大调查和验证深度。

## 规则入口

`.claude/rules/*.md` frontmatter 中的 `paths:` 是适用范围的权威；修改前只读取与目标文件匹配的规则。下表是跨工具索引。

| 修改范围 | 规则文件 |
| --- | --- |
| TypeScript、命名、import、复杂度、lint | `.claude/rules/coding-standards.md` |
| 路由、layout、metadata、缓存、client 边界 | `.claude/rules/conventions.md` |
| 组件、页面 UI、Tailwind、设计 token | `.claude/rules/ui.md` |
| 测试、fixture、mock、行为证明 | `.claude/rules/testing.md` |
| API、安全配置、lead schema、Next 配置 | `.claude/rules/security.md` |
| middleware、OpenNext、Wrangler、部署 | `.claude/rules/cloudflare.md` |
| 内容、messages、站点配置、内容查询 | `.claude/rules/content.md` |
| 翻译 key、locale 路由、i18n 管道 | `.claude/rules/i18n.md` |
| JSON-LD、FAQ schema、SEO 组件 | `.claude/rules/structured-data.md` |

## 验证边界

- 按改动范围运行能够证明结果的最窄验证，再根据发布影响扩大验证。
- `pnpm build`、`pnpm website:build:cf` 和 Playwright webServer 共用 `.next`，不得并行运行。
- 派生和上线工作按 `docs/派生项目交接.md` 分层验证；`pnpm release:verify` 只证明 release lane，不等于正式部署或业务上线。

## 依赖文档

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
