import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CookieBanner } from "@/components/cookie/cookie-banner";
import { createMockTranslations } from "@/test/utils";

// 文案取自真实消息包：断言的是每个 key 落在了哪个控件上。
const t = createMockTranslations();

describe("CookieBanner", () => {
  it("shows only the configured analytics choice", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<CookieBanner onAccept={onAccept} onReject={onReject} />);

    expect(
      screen.getByRole("region", { name: t("cookie.title") }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: t("cookie.learnMore") }),
    ).toHaveAttribute("href", "/privacy");
    expect(screen.queryByText(/marketing/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: t("cookie.acceptAll") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("cookie.rejectAll") }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
