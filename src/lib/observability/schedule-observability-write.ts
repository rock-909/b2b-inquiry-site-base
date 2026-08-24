import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 把观测写入任务调度到买家响应关键路径之外。
 *
 * Cloudflare 运行时走 ctx.waitUntil：响应先返回，闩锁写入在后台完成，
 * Upstash 故障的 2 秒超时不会转嫁给买家。非 Workers 运行时（本地
 * dev/测试）退化为不等待的后台执行。
 */
export function scheduleObservabilityWrite(task: Promise<void>): void {
  try {
    const { ctx } = getCloudflareContext();

    if (ctx) {
      ctx.waitUntil(task);
      return;
    }
  } catch {
    // getCloudflareContext 只能在 Workers 请求上下文内调用；
    // 本地 dev/测试环境直接后台执行。
  }

  task.catch(() => undefined);
}
