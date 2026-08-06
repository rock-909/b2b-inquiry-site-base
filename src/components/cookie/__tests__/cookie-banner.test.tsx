/**
 * @vitest-environment jsdom
 * Tests for CookieBanner component
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieBanner } from "../cookie-banner";

// Mock dependencies
const { mockUseCookieConsent, mockUseTranslations } = vi.hoisted(() => ({
  mockUseCookieConsent: vi.fn(),
  mockUseTranslations: vi.fn(),
}));

vi.mock("@/lib/cookie-consent", () => ({
  useCookieConsent: mockUseCookieConsent,
}));

vi.mock("next-intl", () => ({
  useTranslations: mockUseTranslations,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function createMockTranslations() {
  const translations: Record<string, string> = {
    title: "Cookie Consent",
    description: "We use cookies to improve your experience.",
    learnMore: "Privacy policy",
    manage: "Manage",
    rejectAll: "Reject All",
    acceptAll: "Accept All",
    close: "Close",
    cancel: "Cancel",
    savePreferences: "Save Preferences",
    "preferences.title": "Cookie Preferences",
    "preferences.description": "Choose which cookies you want to allow.",
    "categories.necessary": "Necessary",
    "categories.necessaryDesc": "Required for basic functionality.",
    "categories.analytics": "Analytics",
    "categories.analyticsDesc": "Help us understand how you use our site.",
    "categories.marketing": "Marketing",
    "categories.marketingDesc": "Used for personalized ads.",
  };

  return (key: string) => translations[key] || key;
}

describe("CookieBanner", () => {
  let mockAcceptAll: ReturnType<typeof vi.fn>;
  let mockRejectAll: ReturnType<typeof vi.fn>;
  let mockSavePreferences: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAcceptAll = vi.fn();
    mockRejectAll = vi.fn();
    mockSavePreferences = vi.fn();

    mockUseTranslations.mockReturnValue(createMockTranslations());

    mockUseCookieConsent.mockReturnValue({
      hasConsented: false,
      ready: true,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
      savePreferences: mockSavePreferences,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("visibility", () => {
    it("renders when ready and not consented", () => {
      render(<CookieBanner />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does not render when not ready", () => {
      mockUseCookieConsent.mockReturnValue({
        hasConsented: false,
        ready: false,
        acceptAll: mockAcceptAll,
        rejectAll: mockRejectAll,
        savePreferences: mockSavePreferences,
      });

      render(<CookieBanner />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does not render when already consented", () => {
      mockUseCookieConsent.mockReturnValue({
        hasConsented: true,
        ready: true,
        acceptAll: mockAcceptAll,
        rejectAll: mockRejectAll,
        savePreferences: mockSavePreferences,
      });

      render(<CookieBanner />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("main banner", () => {
    it("renders title and description", () => {
      render(<CookieBanner />);

      expect(screen.getByText("Cookie Consent")).toBeInTheDocument();
      expect(screen.getByText(/We use cookies/)).toBeInTheDocument();
    });

    it("renders privacy policy link", () => {
      render(<CookieBanner />);

      const link = screen.getByRole("link", { name: "Privacy policy" });
      expect(link).toHaveAttribute("href", "/privacy");
    });

    it("renders privacy policy as an independent mobile touch target", () => {
      render(<CookieBanner />);

      const link = screen.getByRole("link", { name: "Privacy policy" });

      expect(link).toHaveAttribute("href", "/privacy");
      expect(link).toHaveClass("min-h-11", "w-fit", "items-center");
      expect(
        link.closest('[data-cookie-privacy-link-row="true"]'),
      ).toBeInTheDocument();
    });

    it("renders all action buttons", () => {
      render(<CookieBanner />);

      expect(
        screen.getByRole("button", { name: "Manage" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reject All" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Accept All" }),
      ).toBeInTheDocument();
    });

    it("calls acceptAll when Accept All button is clicked", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Accept All" }));

      expect(mockAcceptAll).toHaveBeenCalled();
    });

    it("calls rejectAll when Reject All button is clicked", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Reject All" }));

      expect(mockRejectAll).toHaveBeenCalled();
    });
  });

  describe("preferences panel", () => {
    it("shows preferences panel when Manage is clicked", async () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();
      const panel = screen.getByRole("group", {
        name: "Cookie Preferences",
      });
      expect(panel).toHaveAttribute("id", "cookie-preferences-panel");
      expect(panel).toHaveAttribute("data-panel-reveal", "cookie-preferences");
      expect(panel).not.toHaveAttribute("data-state");
      expect(panel).toHaveClass("animate-in");
      expect(panel).toHaveClass("duration-200");
      // Focus is set via requestAnimationFrame, so wait for it
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
      });
    });

    it("shows labeled categories with their default checkbox state", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const necessaryCheckbox = screen.getByRole("checkbox", {
        name: "Necessary",
      });
      const analyticsCheckbox = screen.getByRole("checkbox", {
        name: "Analytics",
      });
      const marketingCheckbox = screen.getByRole("checkbox", {
        name: "Marketing",
      });

      expect(necessaryCheckbox).toBeChecked();
      expect(necessaryCheckbox).toBeDisabled();
      expect(analyticsCheckbox).not.toBeChecked();
      expect(analyticsCheckbox).not.toBeDisabled();
      expect(marketingCheckbox).not.toBeChecked();
      expect(marketingCheckbox).not.toBeDisabled();
    });

    it("can toggle analytics checkbox", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const checkboxes = screen.getAllByRole("checkbox");
      const analyticsCheckbox = checkboxes[1]!;
      fireEvent.click(analyticsCheckbox);

      expect(checkboxes[1]).toBeChecked();
    });

    it("can toggle marketing checkbox", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const checkboxes = screen.getAllByRole("checkbox");
      const marketingCheckbox = checkboxes[2]!;
      fireEvent.click(marketingCheckbox);

      expect(checkboxes[2]).toBeChecked();
    });

    it("closes preferences panel when close button is clicked", async () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Manage" })).toHaveFocus();
      });
    });

    it("closes preferences panel when cancel button is clicked", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
    });

    it("saves preferences with selected values", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      // Enable analytics (second checkbox)
      const checkboxes = screen.getAllByRole("checkbox");
      const analyticsCheckbox = checkboxes[1]!;
      fireEvent.click(analyticsCheckbox);

      // Save preferences
      fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

      expect(mockSavePreferences).toHaveBeenCalledWith({
        analytics: true,
        marketing: false,
      });
    });

    it("closes preferences panel after saving", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

      expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has dialog role", () => {
      render(<CookieBanner />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "false");
    });

    it("has aria-label", () => {
      render(<CookieBanner />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-label", "Cookie Consent");
    });

    it("manage button exposes dialog relationship", async () => {
      render(<CookieBanner />);

      const manageButton = screen.getByRole("button", { name: "Manage" });
      expect(manageButton).toHaveAttribute(
        "aria-controls",
        "cookie-preferences-panel",
      );
      expect(manageButton).toHaveAttribute("aria-haspopup", "dialog");
      expect(manageButton).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(manageButton);
      expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Manage" }),
      ).not.toBeInTheDocument();
      expect(manageButton.closest("[hidden]")).toBeInTheDocument();
      expect(manageButton.closest("[inert]")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Manage" })).toHaveFocus();
      });
      expect(screen.getByRole("button", { name: "Manage" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("keeps the full category card clickable through visible text", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const analyticsCheckbox = screen.getByRole("checkbox", {
        name: "Analytics",
      });
      fireEvent.click(screen.getByText("Analytics"));

      expect(analyticsCheckbox).toBeChecked();
    });

    it("closes preferences panel with Escape", async () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
      const manageButton = screen.getByRole("button", { name: "Manage" });
      expect(manageButton).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => {
        expect(manageButton).toHaveFocus();
      });
    });

    it("removes the global keydown listener when the preferences panel closes", () => {
      const addListener = vi.spyOn(window, "addEventListener");
      const removeListener = vi.spyOn(window, "removeEventListener");
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      const keydownHandler = addListener.mock.calls.find(
        ([eventName]) => eventName === "keydown",
      )?.[1];

      expect(keydownHandler).toEqual(expect.any(Function));

      fireEvent.keyDown(document, { key: "Escape" });

      expect(removeListener).toHaveBeenCalledWith("keydown", keydownHandler);
    });

    it("keeps tab focus inside the preferences panel while open", () => {
      render(<CookieBanner />);

      fireEvent.click(screen.getByRole("button", { name: "Manage" }));

      const panel = screen.getByRole("group", {
        name: "Cookie Preferences",
      });
      const controls = within(panel);
      const closeButton = screen.getByRole("button", { name: "Close" });
      const saveButton = controls.getByRole("button", {
        name: "Save Preferences",
      });

      saveButton.focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(closeButton).toHaveFocus();

      closeButton.focus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(saveButton).toHaveFocus();
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      render(<CookieBanner className="custom-class" />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveClass("custom-class");
    });
  });
});
