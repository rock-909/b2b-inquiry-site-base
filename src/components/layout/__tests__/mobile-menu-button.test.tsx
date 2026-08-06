/**
 * @vitest-environment jsdom
 */

/**
 * MobileMenuButton — the standalone drawer toggle button.
 *
 * Sole owner of proofs about the button in isolation: icon swap, ARIA state,
 * screen-reader label text, translate protection, and pointer/keyboard
 * activation. Drawer wiring lives in mobile-navigation.test.tsx.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMenuButton } from "@/components/layout/mobile-navigation-interactive";
import { createMockUseTranslations } from "@/test/utils";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(),
  useLocale: vi.fn(() => "en"),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">☰</span>,
  X: () => <span data-testid="close-icon">✕</span>,
}));

describe("MobileMenuButton", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
      createMockUseTranslations(),
    );
  });

  it("renders closed state with menu icon and closed ARIA", () => {
    render(<MobileMenuButton isOpen={false} onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).not.toHaveAttribute("aria-label");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).toHaveAttribute("data-state", "closed");
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("close-icon")).not.toBeInTheDocument();
  });

  it("renders open state with close icon and open ARIA", () => {
    render(<MobileMenuButton isOpen={true} onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).not.toHaveAttribute("aria-label");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("close-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("menu-icon")).not.toBeInTheDocument();
  });

  it("swaps icons across state changes", () => {
    const { rerender } = render(
      <MobileMenuButton isOpen={false} onClick={vi.fn()} />,
    );
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();

    rerender(<MobileMenuButton isOpen={true} onClick={vi.fn()} />);
    expect(screen.getByTestId("close-icon")).toBeInTheDocument();

    rerender(<MobileMenuButton isOpen={false} onClick={vi.fn()} />);
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
  });

  it("provides screen-reader label text for both states", () => {
    const { rerender } = render(
      <MobileMenuButton isOpen={false} onClick={vi.fn()} />,
    );
    expect(screen.getByText("Open navigation menu")).toBeInTheDocument();

    rerender(<MobileMenuButton isOpen={true} onClick={vi.fn()} />);
    expect(screen.getByText("Close navigation menu")).toBeInTheDocument();
  });

  it("protects the screen-reader label from machine translation", () => {
    render(<MobileMenuButton isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByTestId("mobile-menu-button-label")).toHaveAttribute(
      "translate",
      "no",
    );
  });

  it("applies a custom className", () => {
    render(
      <MobileMenuButton
        isOpen={false}
        onClick={vi.fn()}
        className="custom-menu-button"
      />,
    );

    expect(screen.getByRole("button", { name: /menu/i })).toHaveClass(
      "custom-menu-button",
    );
  });

  it("calls onClick on pointer and keyboard activation", async () => {
    const onClick = vi.fn();
    render(<MobileMenuButton isOpen={false} onClick={onClick} />);

    const button = screen.getByRole("button", { name: /menu/i });

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
