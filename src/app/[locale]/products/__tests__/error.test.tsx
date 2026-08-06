import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductsRouteError from "../error";

/**
 * 姊妹文件 `contact/error.tsx` 有测试，这个没有——`vitest related` 对它报
 * "No test files found"，pre-commit 钩子把这一条当成通过。
 *
 * 它自己只做一件事：把 `errors.products` 这组文案和 `logContext` 接到共享的
 * `RouteErrorView` 上。抄错命名空间的话，产品页出错时访客看到的是联系页的
 * 文案，日志也归错了类——两者都不会让构建失败。
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

describe("ProductsRouteError", () => {
  const reset = vi.fn();
  const error = new Error("product catalog blew up");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the error and reset handler straight through", () => {
    render(<ProductsRouteError error={error} reset={reset} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { error: Error; reset: () => void },
    ];
    expect(props.error).toBe(error);
    expect(props.reset).toBe(reset);
  });

  it("reads its copy from the products error namespace", () => {
    render(<ProductsRouteError error={error} reset={reset} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { copy: Record<string, string> },
    ];
    expect(props.copy).toEqual({
      title: "errors.products.title",
      description: "errors.products.description",
      tryAgain: "errors.products.tryAgain",
      goHome: "errors.products.goHome",
    });
  });

  it("logs under the Products context", () => {
    render(<ProductsRouteError error={error} reset={reset} />);

    const [props] = mockRouteErrorView.mock.calls[0] as unknown as [
      { logContext: string },
    ];
    expect(props.logContext).toBe("Products");
  });
});
