/**
 * Subprocess runner for the open-next.config.ts wiring gate.
 *
 * 用法: node cloudflare-config-open-next-runner.mjs <rootDir>
 *
 * 在注册了 loader hooks 的子进程里真实执行 <rootDir>/open-next.config.ts，
 * 然后断言 R2 incremental cache 的接线（identity 级）与导出身份。
 * stdout 输出 { ok, missing, forbidden } JSON；断言失败时 ok=false。
 */

import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.argv[2];
if (!rootDir) {
  console.error("usage: node cloudflare-config-open-next-runner.mjs <rootDir>");
  process.exit(2);
}

register(new URL("./cloudflare-config-open-next-hook.mjs", import.meta.url));

const MISSING_LABEL = "incrementalCache: r2IncrementalCache";

function emit(result) {
  process.stdout.write(JSON.stringify(result));
}

try {
  const configModule = await import(
    pathToFileURL(path.join(rootDir, "open-next.config.ts")).href
  );
  const state = globalThis.__openNextConfigCheck;
  const r2Sentinel = globalThis.__cloudflareConfigCheckR2Sentinel;

  const missing = [];
  // 无论以哪种方式失败，根本问题都是 R2 wiring 未被证明——核心标签恒在。
  const requireCoreLabel = () => {
    if (!missing.includes(MISSING_LABEL)) {
      missing.unshift(MISSING_LABEL);
    }
  };

  const calls = state?.calls ?? [];
  if (calls.length !== 1) {
    if (calls.length === 0) {
      // 本地同名假符号不会经过被拦截的导入，mock 从未被调用。
      missing.push(
        "defineCloudflareConfig must be called exactly once (never called — local fakes do not count)",
      );
    } else {
      missing.push(
        `defineCloudflareConfig must be called exactly once (${calls.length} calls)`,
      );
    }
    requireCoreLabel();
  } else {
    // 防御性检查：非对象调用参数（如 null）无法证明任何 wiring。
    if (!calls[0] || typeof calls[0] !== "object") {
      missing.push(
        "defineCloudflareConfig must receive exactly { incrementalCache: <the R2 sentinel> }",
      );
      requireCoreLabel();
    } else {
      const config = calls[0];
      const keys = Object.keys(config);
      if (
        keys.length !== 1 ||
        keys[0] !== "incrementalCache" ||
        config.incrementalCache !== r2Sentinel
      ) {
        missing.push(
          "defineCloudflareConfig must receive exactly { incrementalCache: <the R2 sentinel> }",
        );
        requireCoreLabel();
      }
    }
  }

  // 导出对象必须是 defineCloudflareConfig 的返回对象本身（identity，不是形状）。
  const returnedConfig = state?.returnedConfig;
  if (configModule.default !== returnedConfig) {
    missing.push(
      "exported default must be the object returned by defineCloudflareConfig",
    );
  }

  // 最终 override 必须精确携带 R2 哨兵：输入 wiring 与输出 topology 由同一
  // 个 identity 证明；额外 key 或错误值都会在这里暴露。
  const override = configModule.default?.default?.override;
  const overrideKeys = Object.keys(override ?? {});
  if (
    overrideKeys.length !== 1 ||
    overrideKeys[0] !== "incrementalCache" ||
    override.incrementalCache !== r2Sentinel
  ) {
    missing.push(
      "default.override must carry exactly the approved R2 incremental cache",
    );
    requireCoreLabel();
  }

  emit({ ok: missing.length === 0, missing, forbidden: [] });
} catch (error) {
  // harness 内部任何异常都意味着 wiring 未被证明——同样携带核心标签。
  emit({
    ok: false,
    missing: [
      MISSING_LABEL,
      `open-next.config.ts failed to load under the open-next module harness: ${String(error)}`,
    ],
    forbidden: [],
  });
}
