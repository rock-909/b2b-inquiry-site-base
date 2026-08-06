import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { NavigationProgressBar } from "@/components/navigation/navigation-progress-bar";
import {
  shouldStartHistoryNavigationProgress,
  shouldStartNavigationProgress,
} from "@/components/navigation/navigation-progress";

function createAnchor(href: string): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  return anchor;
}

function setTestLocation(pathname: string, search = "") {
  Object.defineProperties(window.location, {
    href: {
      configurable: true,
      value: `http://localhost${pathname}${search}`,
    },
    pathname: { configurable: true, value: pathname },
    search: { configurable: true, value: search },
  });
}

const plainLeftClick = {
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

const mockUsePathname = vi.fn(() => "/en");
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const mockUseReducedMotion = vi.fn(() => false);

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock("@/lib/motion/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => mockUseReducedMotion(),
}));

describe("NavigationProgressBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUsePathname.mockReturnValue("/en");
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseReducedMotion.mockReturnValue(false);
    setTestLocation("/en");
  });

  afterEach(() => {
    setTestLocation("/en");
    vi.useRealTimers();
  });

  it("starts on internal link clicks and completes when pathname changes", async () => {
    const { rerender } = render(
      <>
        <NavigationProgressBar />
        <a href="/en/products">Products</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Products" }));

    expect(screen.getByTestId("navigation-progress-bar")).toBeInTheDocument();
    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(0.18)",
    });

    mockUsePathname.mockReturnValue("/en/products");
    rerender(
      <>
        <NavigationProgressBar />
        <a href="/en/products">Products</a>
      </>,
    );

    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(1)",
    });

    await act(async () => {
      vi.advanceTimersByTime(280 + 180);
    });
    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });

  it("completes when only the search params change", async () => {
    mockUsePathname.mockReturnValue("/request-quote");
    setTestLocation("/request-quote");

    const { rerender } = render(
      <>
        <NavigationProgressBar />
        <a href="/request-quote?source=mobile_nav_cta">Request quote</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Request quote" }));

    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(0.18)",
    });

    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("source=mobile_nav_cta"),
    );
    rerender(
      <>
        <NavigationProgressBar />
        <a href="/request-quote?source=mobile_nav_cta">Request quote</a>
      </>,
    );

    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(1)",
    });

    await act(async () => {
      vi.advanceTimersByTime(280 + 180);
    });
    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not start for hash-only links", () => {
    render(
      <>
        <NavigationProgressBar />
        <a href="#main-content">Skip</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Skip" }));

    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not start for hash-only browser history changes", () => {
    render(<NavigationProgressBar />);

    act(() => {
      window.history.pushState({}, "", "/en#main-content");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });

  it("starts and completes route-changing history when route hooks update first", async () => {
    mockUsePathname.mockReturnValue("/products");
    setTestLocation("/products");
    const { rerender } = render(<NavigationProgressBar />);

    setTestLocation("/request-quote");
    mockUsePathname.mockReturnValue("/request-quote");
    rerender(<NavigationProgressBar />);

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(1)",
    });

    await act(async () => {
      vi.advanceTimersByTime(280 + 180);
    });
    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });

  it("keeps route-changing history pending until route hooks finish", async () => {
    mockUsePathname.mockReturnValue("/products");
    setTestLocation("/products");
    const { rerender } = render(<NavigationProgressBar />);

    setTestLocation("/request-quote");
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(0.18)",
    });

    await act(async () => {
      vi.advanceTimersByTime(280 + 180);
    });
    expect(screen.getByTestId("navigation-progress-bar")).toBeInTheDocument();

    mockUsePathname.mockReturnValue("/request-quote");
    rerender(<NavigationProgressBar />);
    expect(screen.getByTestId("navigation-progress-bar-fill")).toHaveStyle({
      transform: "scaleX(1)",
    });
  });

  describe("shouldStartNavigationProgress", () => {
    it("starts for a plain left-click on an internal link", () => {
      expect(
        shouldStartNavigationProgress(
          plainLeftClick,
          createAnchor("/en/products"),
          window.location.href,
        ),
      ).toBe(true);
    });

    it("skips when the click default was already prevented", () => {
      expect(
        shouldStartNavigationProgress(
          { ...plainLeftClick, defaultPrevented: true },
          createAnchor("/en/products"),
          window.location.href,
        ),
      ).toBe(false);
    });

    it("skips auxiliary (non-primary) button clicks", () => {
      expect(
        shouldStartNavigationProgress(
          { ...plainLeftClick, button: 1 },
          createAnchor("/en/products"),
          window.location.href,
        ),
      ).toBe(false);
    });

    it("skips modifier clicks that open a new tab or window", () => {
      for (const modifier of [
        "metaKey",
        "ctrlKey",
        "shiftKey",
        "altKey",
      ] as const) {
        expect(
          shouldStartNavigationProgress(
            { ...plainLeftClick, [modifier]: true },
            createAnchor("/en/products"),
            window.location.href,
          ),
        ).toBe(false);
      }
    });

    it("skips download links", () => {
      const anchor = createAnchor("/en/spec.pdf");
      anchor.setAttribute("download", "");

      expect(
        shouldStartNavigationProgress(
          plainLeftClick,
          anchor,
          window.location.href,
        ),
      ).toBe(false);
    });

    it("skips non-internal links", () => {
      expect(
        shouldStartNavigationProgress(
          plainLeftClick,
          createAnchor("#section"),
          window.location.href,
        ),
      ).toBe(false);
    });

    it("skips hash-only targets with equivalent encoded query values", () => {
      expect(
        shouldStartNavigationProgress(
          plainLeftClick,
          createAnchor("/request-quote?config=two%20units#details"),
          "http://localhost/request-quote?config=two+units",
        ),
      ).toBe(false);
    });
  });

  describe("shouldStartHistoryNavigationProgress", () => {
    it("starts for pathname and query changes but not the same route key", () => {
      expect(
        shouldStartHistoryNavigationProgress("/products", "/request-quote"),
      ).toBe(true);
      expect(
        shouldStartHistoryNavigationProgress(
          "/request-quote",
          "/request-quote?source=mobile_nav_cta",
        ),
      ).toBe(true);
      expect(
        shouldStartHistoryNavigationProgress(
          "/request-quote",
          "/request-quote",
        ),
      ).toBe(false);
    });
  });

  it("renders nothing when reduced motion is enabled", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <>
        <NavigationProgressBar />
        <a href="/en/products">Products</a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Products" }));

    expect(
      screen.queryByTestId("navigation-progress-bar"),
    ).not.toBeInTheDocument();
  });
});
