import { readFileSync } from "node:fs";
import { type ComponentProps, useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_CALLBACK_TIMEOUT_LONG } from "@/constants/time";
import { TURNSTILE_WIDGET_HEIGHT_PX } from "@/constants/turnstile-constants";
import { LazyTurnstile } from "@/components/forms/lazy-turnstile";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";

const RESCUE_TIMEOUT_MS = 15_000;

const sentinelTurnstileLabels = {
  unavailable: "安全验证暂时不可用。",
  loadFailed: "安全验证加载失败。",
  slowToLoad: "安全验证加载得比平时慢。",
  devBypass: "开发模式：Turnstile 验证已跳过",
  testMode: "测试模式下已关闭机器人防护",
  rescueBeforeEmail: "请改发邮件 —",
  rescueAfterEmail: "12 小时内回复。",
  rescueSubject: "报价咨询",
};

function createDefaultTestLabels() {
  return createTestInquiryFormCopy().turnstile;
}

const {
  idleCallbacks,
  intersectionCallbacks,
  mockRequestIdleCallback,
  mockTurnstileState,
  mockTurnstileWidget,
  widgetResetSpy,
} = vi.hoisted(() => {
  const mockTurnstileState = { shouldThrow: false };
  const widgetResetSpy = vi.fn();
  const MockTurnstileWidget = vi.fn(
    ({
      size,
      theme,
      className,
      labels,
      onSuccess,
      onError,
      onExpire,
      onDegraded,
      onReadyRef,
    }: {
      size?: string;
      theme?: string;
      className?: string;
      labels?: {
        devBypass: string;
        testMode: string;
      };
      onSuccess?: (token: string) => void;
      onError?: (reason?: string) => void;
      onExpire?: () => void;
      onDegraded?: (kind: "unavailable" | "failed") => void;
      onReadyRef?: (reset: () => void) => (() => void) | void;
    }) => {
      if (mockTurnstileState.shouldThrow) {
        throw new Error("turnstile widget failed to load");
      }

      // 真实控件挂载后把 reset 交给上层；替身照做，重置链路才能被断言。
      useEffect(() => {
        if (!onReadyRef) {
          return undefined;
        }
        return onReadyRef(widgetResetSpy);
      }, [onReadyRef]);

      return (
        <div
          data-testid="turnstile-widget"
          data-size={size}
          data-theme={theme}
          data-classname={className}
          data-label-dev-bypass={labels?.devBypass}
          data-label-test-mode={labels?.testMode}
        >
          <button
            type="button"
            data-testid="turnstile-success"
            onClick={() => onSuccess?.("lazy-token")}
          >
            Success
          </button>
          <button
            type="button"
            data-testid="turnstile-error"
            onClick={() => {
              onDegraded?.("failed");
              onError?.("lazy-error");
            }}
          >
            Error
          </button>
          <button
            type="button"
            data-testid="turnstile-unavailable"
            onClick={() => onDegraded?.("unavailable")}
          >
            Unavailable
          </button>
          <button
            type="button"
            data-testid="turnstile-expire"
            onClick={() => onExpire?.()}
          >
            Expire
          </button>
        </div>
      );
    },
  );

  return {
    idleCallbacks: [] as Array<() => void>,
    intersectionCallbacks: [] as Array<IntersectionObserverCallback>,
    mockRequestIdleCallback: vi.fn((callback: () => void) => {
      idleCallbacks.push(callback);
      return () => undefined;
    }),
    mockTurnstileState,
    mockTurnstileWidget: MockTurnstileWidget,
    widgetResetSpy,
  };
});

vi.mock("@/lib/idle-callback", () => ({
  requestIdleCallback: mockRequestIdleCallback,
}));

vi.mock("@/components/security/turnstile", () => ({
  TurnstileWidget: mockTurnstileWidget,
}));

function getPlaceholderContainer() {
  const placeholder = document.querySelector('[aria-hidden="true"]');

  if (!(placeholder instanceof HTMLDivElement)) {
    throw new Error("Expected LazyTurnstile placeholder to be rendered");
  }

  const container = placeholder.parentElement;

  if (!(container instanceof HTMLDivElement)) {
    throw new Error("Expected LazyTurnstile placeholder container");
  }

  return container;
}

describe("LazyTurnstile", () => {
  beforeEach(() => {
    idleCallbacks.length = 0;
    intersectionCallbacks.length = 0;
    mockTurnstileState.shouldThrow = false;
    widgetResetSpy.mockClear();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "200px";
      readonly scrollMargin = "";
      readonly thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback);
      }

      disconnect() {
        return undefined;
      }

      observe() {
        return undefined;
      }

      takeRecords() {
        return [];
      }

      unobserve() {
        return undefined;
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("keeps the lazy Turnstile entry free of next/dynamic runtime", () => {
    const source = readFileSync("src/components/forms/lazy-turnstile.tsx", {
      encoding: "utf8",
    });

    expect(source).not.toContain("next/dynamic");
  });

  it("keeps a placeholder until idle or visibility triggers rendering", () => {
    render(
      <LazyTurnstile onSuccess={vi.fn()} labels={createDefaultTestLabels()} />,
    );

    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(
      getPlaceholderContainer().style.getPropertyValue(
        "--turnstile-placeholder-height",
      ),
    ).toBe(`${TURNSTILE_WIDGET_HEIGHT_PX.normal}px`);
    expect(mockRequestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      fallbackDelay: IDLE_CALLBACK_TIMEOUT_LONG,
      timeout: IDLE_CALLBACK_TIMEOUT_LONG,
    });
  });

  it("renders on idle and forwards callbacks to the fixed inquiry widget", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onExpire = vi.fn();

    render(
      <LazyTurnstile
        onSuccess={onSuccess}
        onError={onError}
        onExpire={onExpire}
        labels={createDefaultTestLabels()}
      />,
    );

    await act(async () => {
      idleCallbacks[0]?.();
      await vi.dynamicImportSettled();
    });

    const widget = screen.getByTestId("turnstile-widget");
    expect(widget).toHaveAttribute("data-size", "normal");
    expect(widget).toHaveAttribute("data-theme", "auto");
    expect(widget).toHaveAttribute("data-classname", "w-full");

    fireEvent.click(screen.getByTestId("turnstile-success"));
    fireEvent.click(screen.getByTestId("turnstile-error"));
    fireEvent.click(screen.getByTestId("turnstile-expire"));

    expect(onSuccess).toHaveBeenCalledWith("lazy-token");
    expect(onError).toHaveBeenCalledWith("lazy-error");
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("renders when the wrapper enters the viewport", async () => {
    render(
      <LazyTurnstile onSuccess={vi.fn()} labels={createDefaultTestLabels()} />,
    );

    await act(async () => {
      intersectionCallbacks[0]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
  });

  it("shows the single rescue prompt and reports an error when the widget fails", async () => {
    mockTurnstileState.shouldThrow = true;
    const onError = vi.fn();
    const onCaughtError = vi.fn();
    const labels = sentinelTurnstileLabels;

    render(<LazyTurnstile onError={onError} labels={labels} />, {
      onCaughtError,
    });

    await act(async () => {
      idleCallbacks[0]?.();
      await vi.dynamicImportSettled();
    });

    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(labels.loadFailed);
    expect(screen.getByRole("status")).not.toHaveTextContent(
      labels.unavailable,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `mailto:sales@tucsenberg.com?subject=${encodeURIComponent(labels.rescueSubject)}`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      labels.rescueBeforeEmail,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      labels.rescueAfterEmail,
    );
    expect(onError).toHaveBeenCalledWith(labels.loadFailed);
    expect(onCaughtError).toHaveBeenCalledTimes(1);
  });

  it("passes the widget's own localized labels to the shared widget", async () => {
    const labels = sentinelTurnstileLabels;

    render(<LazyTurnstile onSuccess={vi.fn()} labels={labels} />);

    await act(async () => {
      idleCallbacks[0]?.();
      await vi.dynamicImportSettled();
    });

    const widget = screen.getByTestId("turnstile-widget");
    expect(widget).toHaveAttribute("data-label-dev-bypass", labels.devBypass);
    expect(widget).toHaveAttribute("data-label-test-mode", labels.testMode);
  });

  describe("救援行：拿不到令牌时的邮件出路", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function renderAndLoad(
      props: Partial<ComponentProps<typeof LazyTurnstile>> = {},
    ) {
      const labels = createDefaultTestLabels();
      const utils = render(<LazyTurnstile labels={labels} {...props} />);
      await act(async () => {
        idleCallbacks[0]?.();
        await vi.dynamicImportSettled();
      });
      return { labels, ...utils };
    }

    it("shows the rescue line when the widget never produces a token", async () => {
      const { labels } = await renderAndLoad();

      expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();

      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));

      expect(screen.getByRole("link", { name: /sales@/u })).toBeVisible();
      // 这条是页面静止 15 秒后凭空出现的，屏幕阅读器必须能播报出来
      expect(screen.getByRole("status")).toContainElement(
        screen.getByRole("link", { name: /sales@/u }),
      );
      // 超时不等于失败：控件可能只是慢，措辞不能吓退还在正常填表的买家
      expect(screen.getByRole("status")).toHaveTextContent(labels.slowToLoad);
      expect(screen.getByRole("status")).not.toHaveTextContent(
        labels.loadFailed,
      );
    });

    it("stops the rescue timer once a token arrives", async () => {
      await renderAndLoad();

      fireEvent.click(screen.getByTestId("turnstile-success"));
      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));

      expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();
    });

    it("stays quiet when an expired token is renewed in time", async () => {
      await renderAndLoad();

      fireEvent.click(screen.getByTestId("turnstile-success"));
      fireEvent.click(screen.getByTestId("turnstile-expire"));
      // 过期是正常生命周期，widget 会自己续新挑战。起表不等于显示：这一刻
      // 什么都不该出现，否则每个停留够久的买家都会被一条救援行吓退。
      expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();

      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS / 2));
      fireEvent.click(screen.getByTestId("turnstile-success"));
      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));

      expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();
    });

    it("restarts the rescue timer when the token expires and never renews", async () => {
      await renderAndLoad();

      fireEvent.click(screen.getByTestId("turnstile-success"));
      fireEvent.click(screen.getByTestId("turnstile-expire"));
      // 续期悄悄失败（iframe 被企业代理拦、脚本被中间盒换掉、那一秒断网）不触发
      // onError。买家在询盘页停留超过令牌寿命是常态——不起表就是又一个永远
      // 禁用的按钮，而且这次连救援行都没有。
      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));

      expect(screen.getByRole("link", { name: /sales@/u })).toBeVisible();
    });

    it("restarts the rescue timer when the form resets the widget after a submit", async () => {
      let resetWidget: (() => void) | undefined;
      await renderAndLoad({
        onReadyRef: (reset) => {
          resetWidget = reset;
        },
      });

      fireEvent.click(screen.getByTestId("turnstile-success"));
      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));
      expect(screen.queryByRole("link", { name: /sales@/u })).toBeNull();

      // 提交落定后表单清令牌并 reset widget。此刻若 Turnstile 挂了，新挑战
      // 既不 onSuccess 也不 onError，只剩计时器能把买家从死路里捞出来。
      act(() => resetWidget?.());
      expect(widgetResetSpy).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(RESCUE_TIMEOUT_MS));

      expect(screen.getByRole("link", { name: /sales@/u })).toBeVisible();
    });

    it("shows the rescue line as soon as the widget reports an error", async () => {
      const { labels } = await renderAndLoad();

      fireEvent.click(screen.getByTestId("turnstile-error"));

      expect(screen.getByRole("link", { name: /sales@/u })).toBeVisible();
      // 报错了就说报错，不能拿「慢」搪塞
      expect(screen.getByRole("status")).toHaveTextContent(labels.loadFailed);
      // 救援行只能有一个 owner。将来若有人在别处又加一条，这里会变成 2。
      expect(screen.getAllByRole("link", { name: /sales@/u })).toHaveLength(1);
    });

    it("uses the unavailable label when the widget reports a missing site key", async () => {
      const { labels } = await renderAndLoad();

      fireEvent.click(screen.getByTestId("turnstile-unavailable"));

      expect(screen.getByRole("status")).toHaveTextContent(labels.unavailable);
      expect(screen.getAllByRole("link", { name: /sales@/u })).toHaveLength(1);
      expect(screen.getByRole("link", { name: /sales@/u })).toHaveAttribute(
        "href",
        `mailto:sales@tucsenberg.com?subject=${encodeURIComponent(labels.rescueSubject)}`,
      );
    });
  });
});
