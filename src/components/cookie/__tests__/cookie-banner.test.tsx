import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CookieBanner } from "@/components/cookie/cookie-banner";
import { createMockTranslations } from "@/test/utils";

// 文案取自真实消息包：断言的是每个 key 落在了哪个控件上。
const t = createMockTranslations();

describe("CookieBanner", () => {
  function renderBanner() {
    const handlers = { onAccept: vi.fn(), onReject: vi.fn(), onSave: vi.fn() };
    render(<CookieBanner {...handlers} />);
    return handlers;
  }
  const click = (name: string) =>
    fireEvent.click(screen.getByRole("button", { name }));

  it("links to the privacy policy and offers equal accept and reject buttons", () => {
    const { onAccept, onReject } = renderBanner();

    expect(
      screen.getByRole("region", { name: t("cookie.title") }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: t("cookie.learnMore") }),
    ).toHaveAttribute("href", "/privacy");

    const accept = screen.getByRole("button", { name: t("cookie.acceptAll") });
    const reject = screen.getByRole("button", { name: t("cookie.rejectAll") });
    expect(accept.className).toBe(reject.className);

    click(t("cookie.acceptAll"));
    click(t("cookie.rejectAll"));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("keeps the category choices behind an expandable Customize button", () => {
    renderBanner();
    const customize = screen.getByRole("button", { name: t("cookie.customize") });
    expect(customize).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox")).toBeNull();

    click(t("cookie.customize"));
    expect(customize).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("starts with both categories unchecked and saves nothing granted by default", () => {
    const { onSave } = renderBanner();
    click(t("cookie.customize"));
    expect(
      screen.getByRole("checkbox", { name: t("cookie.analytics") }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: t("cookie.advertising") }),
    ).not.toBeChecked();

    click(t("cookie.saveChoices"));
    expect(onSave).toHaveBeenCalledWith({
      analytics: false,
      advertising: false,
    });
  });

  it("lets the visitor grant analytics without advertising", () => {
    const { onSave } = renderBanner();
    click(t("cookie.customize"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: t("cookie.analytics") }),
    );
    click(t("cookie.saveChoices"));
    expect(onSave).toHaveBeenCalledWith({
      analytics: true,
      advertising: false,
    });
  });

  it("lets the visitor grant advertising without analytics", () => {
    const { onSave } = renderBanner();
    click(t("cookie.customize"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: t("cookie.advertising") }),
    );
    click(t("cookie.saveChoices"));
    expect(onSave).toHaveBeenCalledWith({
      analytics: false,
      advertising: true,
    });
  });
});
