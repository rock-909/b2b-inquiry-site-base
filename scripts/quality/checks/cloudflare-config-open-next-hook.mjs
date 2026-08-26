/**
 * ESM loader hooks for the open-next.config.ts wiring gate.
 *
 * 拦截且仅拦截两个模块说明符，让任意 rootDir 下的配置文件都能在无真实
 * @opennextjs/cloudflare 安装的情况下被真实加载执行：
 *
 * - "@opennextjs/cloudflare" -> 可记录调用的 defineCloudflareConfig mock；
 *   返回对象把调用参数展开为 default.override（与真实包一致地透传 wiring）。
 * - ".../r2-incremental-cache" -> 进程级单例哨兵对象，用于 identity 断言。
 */

const R2_SENTINEL_KEY = "__cloudflareConfigCheckR2Sentinel";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@opennextjs/cloudflare") {
    return { shortCircuit: true, url: "opennext-config-check:mock-package" };
  }
  if (
    specifier ===
    "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
  ) {
    return { shortCircuit: true, url: "opennext-config-check:r2-sentinel" };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === "opennext-config-check:mock-package") {
    return {
      shortCircuit: true,
      format: "module",
      source: `
        const state = (globalThis.__openNextConfigCheck ??= { calls: [] });
        export function defineCloudflareConfig(config = {}) {
          state.calls.push(config);
          // 与真实包一致：调用参数被透传到 default.override 上。
          const returnedConfig = { default: { override: { ...config } } };
          state.returnedConfig = returnedConfig;
          return returnedConfig;
        }
      `,
    };
  }

  if (url === "opennext-config-check:r2-sentinel") {
    return {
      shortCircuit: true,
      format: "module",
      source: `
        export default (globalThis["${R2_SENTINEL_KEY}"] ??= {
          name: "r2-incremental-cache",
        });
      `,
    };
  }

  return nextLoad(url, context);
}
