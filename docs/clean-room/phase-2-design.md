# Phase 2 clean-room 派生设计

## 目标

从同一个候选快照建立三个一次性虚构 B2B 网站，验证新业务是否真的主要修改品牌、内容、页面、前端设计和公开配置，而不需要改动询盘、安全、provider、Cloudflare 构建和 release 基础设施。

本阶段不接触真实业务，不证明公开上线，也不发布稳定 `v1.0.0`。

## 固定候选快照

- 起始提交：`8e241ea`
- 本轮 tag：`candidate-2026-08-06.1`
- 三个实验必须从该 tag 独立开始。
- tag 只表示临时候选快照，不表示稳定版本。

## 三个虚构场景

### 产品目录型

- 公司：`Northline Process Equipment`
- 域名：`northline-process.example.invalid`
- 页面：`/products` 和三个独立产品详情页。
- 询盘：general inquiry 和 offering-specific quote。
- 目的：证明模板可以增加产品目录，而不恢复旧 catalog model。

### 纯服务型

- 公司：`FieldAxis Reliability Services`
- 域名：`fieldaxis.example.invalid`
- 页面：`/services` 和三个独立服务详情页。
- 询盘：围绕项目范围、现场条件和服务区域。
- 目的：证明模板没有隐藏的产品前提。

### 标准 offering 与定制需求混合型

- 公司：`ModuCore Industrial Systems`
- 域名：`moducore.example.invalid`
- 页面：`/solutions`、两个标准方案详情页和 `/custom-project`。
- 询盘：general inquiry、offering-specific inquiry 和 custom request。
- 目的：证明 `offeringId`、`interest` 和 `message` 足够表达混合业务，不需要动态表单系统。

## 修改边界

### 允许修改

- `src/app/[locale]/**` 中的业务页面；
- `src/components/**` 中的前端展示组件；
- `src/config/offerings.ts`；
- 站点身份、导航、页面和 SEO 配置；
- `content/**`、`messages/**`、`public/**`；
- 样式、设计 token 和对应业务页面测试；
- 场景专属的公开 Worker、R2 和示例域名配置值。

### 禁止修改

- `src/app/api/inquiry/**`；
- `src/lib/lead-pipeline/**`；
- Turnstile、honeypot、CORS、限流；
- Airtable、Resend 和日志脱敏逻辑；
- OpenNext/Cloudflare 构建脚本；
- release runner 核心逻辑；
- 公共测试基础设施。

如果场景必须修改禁止区域才能成立，记录为 `TEMPLATE_STRUCTURAL_FAILURE`，不在派生站中绕过。

## 执行模型

1. 从同一 tag 建立三个 detached worktree。
2. 每个实验只读取自己的 brief、修改边界和验证要求。
3. 三个实验先全部完成诊断，不边做边修改模板。
4. 控制端统一核对 Git diff、禁止区域和验证结果。
5. 任一实验发现结构性失败时，先汇总三个实验，再回模板修一次根因。
6. 修复后发布新 candidate tag，丢弃旧实验并从零重做三个场景。

三个实验可以并行完成页面、内容和轻量检查；Playwright、Next build、OpenNext build 和 Wrangler dry-run 串行执行。

## 证据

模板仓保留：

```text
docs/clean-room/phase-2/
├── briefs/
│   ├── product-catalog.md
│   ├── service-business.md
│   └── hybrid-offering.md
├── run-1/
│   ├── product-catalog-report.md
│   ├── product-catalog.patch.gz
│   ├── service-business-report.md
│   ├── service-business.patch.gz
│   ├── hybrid-offering-report.md
│   └── hybrid-offering.patch.gz
└── run-1-summary.md
```

每份报告记录：起始 tag/SHA、修改文件、禁止区域扫描、验证命令和结果、strict sentinel 结果、结构性问题和最终判定。

不建设结果数据库、JSON schema、generator、profile 或长期派生分支。

## 单场景通过条件

1. 模板品牌和示例内容已替换为场景身份。
2. brief 规定的页面、导航、SEO 和询盘入口完整。
3. general inquiry 与 offering-specific inquiry 符合场景合同。
4. 没有修改禁止区域。
5. 类型、lint、测试、内容检查和 build 通过。
6. OpenNext build 与 Wrangler dry-run 通过。
7. `PUBLIC_LAUNCH_STRICT` 因虚构域名、真实 secret 和 owner acceptance 缺失而保持红灯。
8. brief、压缩 patch、修改清单和验证证据已保存。

## Phase 2 完成边界

三个场景必须来自同一 candidate tag，并全部从干净目录完成。任一场景存在结构性失败，Phase 2 即未通过，必须修模板并重新派生。

即使三个场景通过，模板仍保持：

```text
INDEPENDENT_NEUTRAL_BASE_CANDIDATE
```

本阶段只增加 clean-room 派生证据。mutation、冷启动 Agent、真实 QA provider 和公开部署验收仍属于后续阶段。
