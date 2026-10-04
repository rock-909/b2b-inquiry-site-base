import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContactRouteError from "../error";

/**
 * 这个文件只做一件事：把 `errors.contact` 这组文案和 `logContext` 接到共享的
 * `RouteErrorView` 上。抄错命名空间的话，联系页出错时访客看到的是产品页的文案，
 * 日志也归错了类——两者都不会让构建失败。
 *
 * 渲染出来的 DOM、按钮点击、日志时机全部属于 `RouteErrorView`，证明放在
 * `src/components/errors/__tests__/route-error-view.test.tsx`，不在这里重测一遍。
 */

const { mockRouteErrorView } = vi.hoisted(() => ({
  mockRouteErrorView: vi.fn(() => <div data-testid="route-error-view" />),
}));

vi.mock("@/components/errors/route-error-view", () => ({
  RouteErrorView: mockRouteErrorView,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

describe("ContactRouteError", () => {
  const retry = vi.fn();
  const error = new Error("Contact form submission failed");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the error and retry handler straight through", () => {
    render(<ContactRouteError error={error} retry={retry} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { error: Error; retry: () => void },
    ];
    expect(props.error).toBe(error);
    expect(props.retry).toBe(retry);
  });

  it("reads its copy from the contact error namespace", () => {
    render(<ContactRouteError error={error} retry={retry} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { copy: Record<string, string> },
    ];
    expect(props.copy).toEqual({
      title: "errors.contact.title",
      description: "errors.contact.description",
      tryAgain: "errors.contact.tryAgain",
      goHome: "errors.contact.goHome",
    });
  });

  it("logs under the Contact context", () => {
    render(<ContactRouteError error={error} retry={retry} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { logContext: string },
    ];
    expect(props.logContext).toBe("Contact");
  });
});
