# Product Context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Status

这是英文 B2B 询盘站模板的产品意图入口，供设计、内容和实现类 AI agent 使用；它不参与网站运行、构建或 CI。与当前代码、配置或运行行为冲突时，以实际行为为准并更新本文。

旧 starter/profile 工具已退役；历史说明不作为当前功能或派生前置条件。默认页面仅首页、联系、隐私和条款。

模板核心是询盘基础能力，不是固定产品目录引擎。派生站按真实需求增加业务页面，不必先建产品目录或服务模型；询盘链路负责把兴趣转成可处理的需求。

## Users

派生站按实际业务确认买家。以下是工业/OEM 场景的参考角色，不是模板要求覆盖的用户或栏目。

| 角色 | 关心什么 | 网站要给的答案 |
| --- | --- | --- |
| 采购 / 供应链经理 | 供应商能否满足需求、响应是否清楚 | Offering 范围、关键规格或服务边界、报价路径 |
| 分销商 / 批发买家 | 是否适合自有渠道销售或项目备货 | OEM/批发范围、包装或交付资料、MOQ 与询盘要求 |
| 技术评估方 | 产品结构、规格或服务边界是否适用 | 详情页、规格或 scope、FAQ，以及确有来源的下载件 |
| 业主 / 操作方 | 询盘是否会被接住 | Request Quote、Contact、提交后预期、邮件/CRM 路径 |

## Product Purpose

当前目标：让访问者快速理解供应商提供什么产品或服务，并自然进入报价或联系路径；资料下载只在派生业务确有可维护文件时增加。

成功的样子：

1. 首页简洁说明业务定位、适用对象和下一步；不强制产品线叙事。
2. 派生站按需要提供产品、服务或混合 offering 页面，让买家判断适用范围。
3. 只在真实业务需要时增加规格、scope、FAQ、下载件或 RFQ 字段，以减少来回沟通。
4. 询盘路径稳定，不能因为文档、旧 starter 内容或 profile 机制误导维护者。

## RFQ Conversion

RFQ 和 CTA 要降低“我该怎么问”的成本，不要把表单做成营销问卷。

- 默认使用通用询盘；只有业务处理确实需要时，才增加产品或服务选择。
- 按实际业务提示必要背景，不要求默认收集国家、数量、规格或附件等工业采购信息。
- 按真实处理流程说明下一步，不预设按产品线或规格分流。
- 不承诺未经验证的固定价格、固定交期、认证、客户数量、工程案例或国家覆盖。

## Trust and Messaging Rules

Buyer-visible claims must trace to current content, config, product constants, or
owner source. Process expectations can explain what happens next, but not promise
fixed timing. Specs, materials, structure, downloads, and FAQ should support the
buyer's decision.

- Use when true for the derived business: factory supply, configured offerings,
  OEM / wholesale, request quote, product specifications, service scope,
  application fit, maintained downloads, and project requirements.
- Avoid: fake proof, unsupported certifications, exact price promises, guaranteed
  timing, vague “best quality”, and decorative badges without a real source.

## Brand Personality

底座不规定品牌个性。以下语气可作为起点，派生站按品牌与买家调整：

声音：

- 直接、具体、克制。
- 用规格、适用边界、交付路径说话，不堆形容词。
- 使用符合真实业务的表达，不夸大，不承诺未经证明的结果。
- 英文要自然，不像翻译稿。

## Anti-references

### 主反例：Alibaba.com 式 B2B 供应商网站

要避开：

1. **视觉密度过高**——首页堆满产品瓦片，眼睛不知道看哪里。
2. **信任靠徽章堆**——金色徽章、年限、认证图标当证据。
3. **没有视觉主角**——任何供应商看起来都一样。
4. **模板感重**——一眼像批量生成的外贸站。

工业采购场景可参考以下取舍，不作为其他业务的固定风格：

- 一屏讲清一件事。
- 信任靠具体产品、规格、流程和可验证资料。
- 产品页先回答采购和技术评估问题，再引导询盘。
- 保持现代 B2B 技术感，但不做花哨 SaaS/AI 官网。

## Design Principles

1. **证据贴着主张走**——每一条卖点旁边尽量有规格、流程、下载件或可验证细节。
2. **节奏胜过密度**——宁可少而清楚，不把页面变成产品墙。
3. **询盘路径清楚**——RFQ、Contact、可选下载件和提交后预期必须互相支持。
4. **维护面要清楚**——当前内容与历史记录要分开标注。
5. **工艺感来自细节**——留白、对齐、字号阶梯、动效克制，比大特效更重要。

## Accessibility & Inclusion

- **WCAG 2.2 AA** 作为默认标准。
- 所有可交互元素必须有可见焦点状态。
- 颜色不能是唯一的状态指示。
- `prefers-reduced-motion` 必须生效。
- 移动端正文字号 ≥16px，行高 ≥1.5。
- 关键路径在禁用 JavaScript 时仍要有基本 HTML 体验；真实提交默认依赖 JS + Turnstile。

## Source Documents

当前站点入口：

- `README.md`
- `docs/项目.md`
- `docs/技术栈.md`
- `docs/质量门禁.md`
- `docs/派生站工作流.md`
- `docs/派生项目交接.md`

设计：

- `DESIGN.md`
- `docs/design/设计真相.md`

派生、验证和上线统一从 `docs/派生项目交接.md` 进入。
