import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorView } from "@/components/errors/route-error-view";

/**
 * 两个路由报错页（contact、products）都是这个组件的薄包装，各自只负责挑命名空间。
 * 真正会被访客看到、会被点击、会写日志的行为全在这里，而这里原先一条测试都没有——
 * 两个包装的测试各自间接测同一套 DOM，改坏共享组件时报错落在包装的名字上。
 */

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const copy = {
  title: "Contact form temporarily unavailable",
  description: "Our team will look into this issue immediately.",
  tryAgain: "Try again",
  goHome: "Back to homepage",
};

describe("RouteErrorView", () => {
  const reset = vi.fn();
  const error = new Error("route blew up");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the copy it was handed", () => {
    render(
      <RouteErrorView
        error={error}
        reset={reset}
        logContext="Contact"
        copy={copy}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      copy.title,
    );
    expect(screen.getByText(copy.description)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.tryAgain }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.goHome })).toBeInTheDocument();
  });

  it("retries the failed route segment when the retry button is clicked", () => {
    render(
      <RouteErrorView
        error={error}
        reset={reset}
        logContext="Contact"
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.tryAgain }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("offers the homepage as the way out", () => {
    render(
      <RouteErrorView
        error={error}
        reset={reset}
        logContext="Contact"
        copy={copy}
      />,
    );

    expect(screen.getByRole("link", { name: copy.goHome })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("logs the failure once, under the caller's context", () => {
    render(
      <RouteErrorView
        error={error}
        reset={reset}
        logContext="Products"
        copy={copy}
      />,
    );

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith("Products route error", error);
  });

  it("logs again when a second failure replaces the first", () => {
    const { rerender } = render(
      <RouteErrorView
        error={error}
        reset={reset}
        logContext="Contact"
        copy={copy}
      />,
    );

    const nextError = new Error("and again");
    rerender(
      <RouteErrorView
        error={nextError}
        reset={reset}
        logContext="Contact"
        copy={copy}
      />,
    );

    expect(mockLoggerError).toHaveBeenCalledTimes(2);
    expect(mockLoggerError).toHaveBeenLastCalledWith(
      "Contact route error",
      nextError,
    );
  });
});
