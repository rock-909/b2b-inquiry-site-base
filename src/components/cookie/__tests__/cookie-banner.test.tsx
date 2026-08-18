import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CookieBanner } from "@/components/cookie/cookie-banner";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      title: "Analytics cookies",
      description: "Optional analytics only.",
      learnMore: "Privacy policy",
      rejectAll: "No thanks",
      acceptAll: "Allow analytics",
    })[key] ?? key,
}));

describe("CookieBanner", () => {
  it("shows only the configured analytics choice", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<CookieBanner onAccept={onAccept} onReject={onReject} />);

    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Privacy policy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(screen.queryByText(/marketing/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
