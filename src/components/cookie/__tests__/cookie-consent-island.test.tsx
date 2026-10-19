import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentIsland } from "@/components/cookie/cookie-consent-island";
import { CookieSettingsButton } from "@/components/cookie/cookie-settings-button";

const { controllerLoaded } = vi.hoisted(() => ({ controllerLoaded: vi.fn() }));

// 工厂只在控制器模块首次被加载时执行，用来证明未配置 GA 时不下载它。
vi.mock(
  "@/components/cookie/cookie-consent-controller",
  async (importOriginal) => {
    controllerLoaded();
    return importOriginal();
  },
);

vi.mock("@/components/cookie/cookie-banner", () => ({
  CookieBanner: ({ onAccept }: { onAccept: () => void }) => (
    <button type="button" onClick={onAccept}>
      allow
    </button>
  ),
}));

vi.mock("@/components/monitoring/enterprise-analytics-island", () => ({
  EnterpriseAnalyticsIsland: ({
    analyticsAllowed,
  }: {
    analyticsAllowed: boolean;
  }) => <div data-testid="analytics" data-allowed={String(analyticsAllowed)} />,
}));

describe("CookieConsentIsland", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
  });

  // 必须排在已配置用例之前：模块加载后工厂不会再次执行。
  it("renders nothing and never loads the consent code when analytics is not configured", async () => {
    const { container } = render(<CookieConsentIsland />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
    expect(controllerLoaded).not.toHaveBeenCalled();
  });

  it("asks once when GA is configured and enables analytics after acceptance", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    render(<CookieConsentIsland />);

    const allow = await screen.findByRole("button", { name: "allow" });
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "data-allowed",
      "false",
    );
    fireEvent.click(allow);
    expect(screen.queryByRole("button", { name: "allow" })).toBeNull();
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "data-allowed",
      "true",
    );
  });

  it("lets the visitor withdraw a stored analytics choice from the cookie settings button", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    render(
      <>
        <CookieConsentIsland />
        <CookieSettingsButton label="Cookie settings" />
      </>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "allow" }));
    expect(localStorage.getItem("cookie-consent")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(screen.getByRole("button", { name: "allow" })).toBeInTheDocument();
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "data-allowed",
      "false",
    );
    expect(localStorage.getItem("cookie-consent")).toBeNull();
  });
});
