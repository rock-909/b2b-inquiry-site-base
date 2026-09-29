import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "@/components/security/turnstile";
import { captureExpectedConsoleErrors } from "@/test/console";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";

// 这里刻意不 mock `@marsidev/react-turnstile`：脚本注入与 onerror 挂载发生在库内部，
// mock 掉就证明不了买家屏蔽 challenges.cloudflare.com 时会发生什么。
const labels = {
  ...createTestInquiryFormCopy().turnstile,
  loadFailed: "Security check failed to load.",
  rescueBeforeEmail: "Please email us at",
  rescueAfterEmail: "We reply within 12 hours.",
  rescueEmail: "rescue@fieldaxis.test",
  rescueSubject: "Quote request",
};

const SCRIPT_SELECTOR = 'script[src*="challenges.cloudflare.com"]';
// 必须大于组件的等待超时；具体数值不属于契约。
const LONGER_THAN_LOAD_TIMEOUT_MS = 60_000;
// 覆盖库的 MutationObserver 与每 50ms 一次的 window.turnstile 轮询，远小于等待超时。
const WIDGET_RENDER_SETTLE_MS = 200;

type TurnstileGlobal = { turnstile?: unknown };

function findInjectedScript() {
  const script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  expect(script).not.toBeNull();
  return script as HTMLScriptElement;
}

function expectRescueEmailVisible() {
  expect(screen.getByRole("status")).toHaveTextContent(labels.loadFailed);
  expect(
    screen.getByRole("link", { name: labels.rescueEmail }),
  ).toHaveAttribute(
    "href",
    `mailto:${labels.rescueEmail}?subject=${encodeURIComponent(labels.rescueSubject)}`,
  );
}

describe("TurnstileWidget when the Cloudflare script cannot load", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key-12345");
    vi.stubEnv("NEXT_PUBLIC_TEST_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_BYPASS", "false");
  });

  afterEach(() => {
    // 先卸载控件：它的清理逻辑会调用 window.turnstile.remove。
    cleanup();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((node) => node.remove());
    delete (window as TurnstileGlobal).turnstile;
    vi.useRealTimers();
  });

  it("offers the email fallback when the script is blocked, without granting a token", async () => {
    const consoleError = captureExpectedConsoleErrors("Turnstile");
    const onSuccess = vi.fn();
    render(<TurnstileWidget labels={labels} onSuccess={onSuccess} />);
    // 库靠 MutationObserver 发现脚本标签，让它的状态更新在 act 内落地。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WIDGET_RENDER_SETTLE_MS);
    });
    expect(screen.queryByRole("link", { name: labels.rescueEmail })).toBeNull();

    act(() => {
      findInjectedScript().dispatchEvent(new Event("error"));
    });

    expectRescueEmailVisible();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("offers the email fallback when the script never settles and no widget renders", async () => {
    const onSuccess = vi.fn();
    render(<TurnstileWidget labels={labels} onSuccess={onSuccess} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LONGER_THAN_LOAD_TIMEOUT_MS);
    });

    expectRescueEmailVisible();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not interrupt a rendered widget whose challenge is still in progress", async () => {
    const renderWidget = vi.fn(() => "widget-1");
    (window as TurnstileGlobal).turnstile = {
      render: renderWidget,
      remove: vi.fn(),
    };
    render(<TurnstileWidget labels={labels} />);

    // 先让库发现 window.turnstile 并渲染控件，再让等待超时走完。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WIDGET_RENDER_SETTLE_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LONGER_THAN_LOAD_TIMEOUT_MS);
    });

    expect(renderWidget).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: labels.rescueEmail })).toBeNull();
  });
});
