import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LazyTurnstile } from "@/components/forms/lazy-turnstile";
import { createTestTurnstileLabels } from "@/test/inquiry-test-messages";

/**
 * 懒加载 chunk 一直 pending（慢网、中间盒吞包、CDN 半死）时的救援证明。
 *
 * 这种形状下 `LazyIslandErrorBoundary` 不触发——它只管 reject——`TurnstileWidget`
 * 永远不挂载。救援计时器只要住在 widget 内部，就永远不会起跑，买家会停在一个
 * 拿不到令牌、永远禁用的提交按钮前。
 *
 * 单独一个文件，是因为这里必须把整个 turnstile 模块 mock 成永不 settle，
 * 跟 `lazy-turnstile.test.tsx` 里那个能正常渲染的替身互斥。
 */

// 永不 settle 的模块工厂：React.lazy 的 promise 一直挂着，Suspense 停在 fallback。
vi.mock(
  "@/components/security/turnstile",
  () => new Promise<never>(() => undefined),
);

const RESCUE_TIMEOUT_MS = 15_000;

describe("LazyTurnstile 救援行：懒加载模块挂起", () => {
  it("shows the rescue line when the lazy chunk never settles", () => {
    vi.useFakeTimers();
    const labels = createTestTurnstileLabels();

    render(<LazyTurnstile onSuccess={vi.fn()} labels={labels} />);

    expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(RESCUE_TIMEOUT_MS);
    });

    // chunk 挂起和控件迟迟不出令牌是同一条出路：15 秒后必须给买家一个邮箱。
    expect(screen.getByRole("link", { name: /sales@/u })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(labels.slowToLoad);

    vi.useRealTimers();
  });
});
