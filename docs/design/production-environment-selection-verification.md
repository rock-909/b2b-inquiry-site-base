# R2：部署环境选择测试修正记录

`tests/architecture/deploy-workflow-contract.test.ts` 原先比较表达式源码，
不能证明 production / preview 输入的环境选择行为。
新增开发依赖 `@actions/expressions` 的唯一消费者是该测试，使用 GitHub
表达式求值器，避免维护自制解释器。本记录保存本轮要求的验证证据。

## 修正前复现

依赖安装后运行以下命令，退出码为 1：语义不变的括号导致原断言失败。

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
const actual = load(readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8')).jobs['build-and-deploy'].environment;
const equivalent = "${{ (inputs.environment == 'production') && 'production' || '' }}";
try { assert.equal(equivalent, actual); } catch { console.log('Reproduced R2: existing exact-source assertion rejects equivalent parenthesized selection.'); process.exitCode = 1; }
JS
```

## 修正后验证

运行 `pnpm exec vitest run tests/architecture/deploy-workflow-contract.test.ts`：
1 个文件通过，12 个测试通过。

- 实际 workflow 表达式：production → `production`，preview → 空字符串。
- 同一断言接受修正前复现中的等价括号表达式。
- 反向检查：始终为空、始终为 production、反转选择，均触发环境选择断言失败；
  测试确认失败消息来自选择断言，而非表达式解析错误。

此证据仅证明环境选择，不证明 GitHub 外部 main-only 策略或 secrets 配置。
未执行部署、完整测试或 lint 套件。
