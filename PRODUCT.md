# Product Context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Status

这是 Tucsenberg 英文 B2B 官网项目的产品意图入口，供设计、内容和实现类 AI agent 使用；它不参与网站运行、构建或 CI。与当前代码、配置或运行行为冲突时，以实际行为为准并更新本文。

本仓已经从 `showcase-website-starter` 派生成具体站点。保留的 starter/profile 代码、测试和文档属于继承工具或历史说明；当前页面、内容、询盘路径和上线证明都应按 Tucsenberg 站点判断。

## Users

当前站点优先服务海外防洪屏障采购、批发/OEM 买家和技术评估方。

| 角色 | 关心什么 | 网站要给的答案 |
| --- | --- | --- |
| 采购 / 供应链经理 | 供应商能不能稳定给货、响应是否清楚 | 产品线、规格范围、打样/报价路径、资料下载 |
| 分销商 / 批发买家 | 是否适合自有渠道销售或项目备货 | OEM/批发范围、包装/资料、MOQ 与询盘信息要求 |
| 技术评估方 | 产品结构、规格、适用边界 | HTML 规格表、产品详情、FAQ、PDF specs |
| 业主 / 操作方 | 询盘是否会被接住 | Request Quote、Contact、提交后预期、邮件/CRM 路径 |

## Product Purpose

当前目标：让访问者快速理解 Tucsenberg 做哪些防洪屏障产品，并自然进入报价、资料下载或联系路径。

成功的样子：

1. 首页 10 秒内说清“防洪屏障工厂供应 + 五条产品线”。
2. 产品页能让买家判断哪条产品线适合自己的采购场景。
3. 规格、FAQ、下载件和 RFQ 字段能减少来回沟通。
4. 询盘路径稳定，不能因为文档、旧 starter 内容或 profile 机制误导维护者。

## RFQ Conversion

RFQ 和 CTA 要降低“我该怎么问”的成本，不要把表单做成营销问卷。

- 先确认产品兴趣：ABS flood barriers、Aluminum flood gates、Absorbent flood
  bags、Flood tube dams、FRP flood barriers，或 general inquiry。
- 鼓励买家补充项目国家/地区、应用场景、预计数量、规格要求、交期压力和附件准备情况。
- 说明下一步是 Tucsenberg 按产品线、规格和项目背景判断报价或资料需求。
- 不承诺未经验证的固定价格、固定交期、认证、客户数量、工程案例或国家覆盖。

## Trust and Messaging Rules

Buyer-visible claims must trace to current content, config, product constants, or
owner source. Process expectations can explain what happens next, but not promise
fixed timing. Specs, materials, structure, downloads, and FAQ should support the
buyer's decision.

- Use: factory supply, flood barrier products, OEM / wholesale, request quote,
  product specifications, application fit, datasheet/PDF download, project
  requirements.
- Avoid: fake proof, unsupported certifications, exact price promises, guaranteed
  timing, vague “best quality”, and decorative badges without a real source.

## Brand Personality

**三个词：专业、当代、可靠。**

声音：

- 直接、具体、克制。
- 用规格、适用边界、交付路径说话，不堆形容词。
- 像一个熟悉工厂和外贸询盘的人跟客户讲话：不夸大，不装高端，不承诺未经证明的结果。
- 英文要自然，不像翻译稿。

## Anti-references

### 主反例：Alibaba.com 式 B2B 供应商网站

要避开：

1. **视觉密度过高**——首页堆满产品瓦片，眼睛不知道看哪里。
2. **信任靠徽章堆**——金色徽章、年限、认证图标当证据。
3. **没有视觉主角**——任何供应商看起来都一样。
4. **模板感重**——一眼像批量生成的外贸站。

当前站必须走反方向：

- 一屏讲清一件事。
- 信任靠具体产品、规格、流程和可验证资料。
- 产品页先回答采购和技术评估问题，再引导询盘。
- 保持现代 B2B 技术感，但不做花哨 SaaS/AI 官网。

## Design Principles

1. **证据贴着主张走**——每一条卖点旁边尽量有规格、流程、下载件或可验证细节。
2. **节奏胜过密度**——宁可少而清楚，不把页面变成产品墙。
3. **询盘路径清楚**——RFQ、Contact、PDF 下载和提交后预期必须互相支持。
4. **维护面要清楚**——Tucsenberg 当前内容与 inherited starter 工具要分开标注。
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
- `docs/README.md`
- `docs/项目.md`
- `docs/技术栈.md`
- `docs/架构与行为.md`
- `docs/开发与维护.md`
- `docs/正式上线标准.md`
- `docs/技术问题与决策.md`

设计与组件治理：

- `DESIGN.md`
- `docs/design/设计真相.md`
- `docs/design/组件治理.md`

继承 starter/profile 边界已退出当前文档入口；当前维护从 `docs/README.md`、`docs/项目.md`、`docs/开发与维护.md` 和 `docs/正式上线标准.md` 进入。
