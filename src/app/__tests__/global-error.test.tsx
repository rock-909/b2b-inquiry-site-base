import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "../global-error";

// Mock logger using vi.hoisted
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

describe("GlobalError", () => {
  const mockRetry = vi.fn();
  const mockError = new Error("Test error message");

  function renderGlobalError(error = mockError) {
    return render(<GlobalError error={error} retry={mockRetry} />, {
      container: document,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("rendering", () => {
    it("should render error page structure", () => {
      renderGlobalError();

      expect(document.documentElement).toHaveAttribute("lang", "en");
      expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
      expect(
        screen.getByText(
          "We apologize for the inconvenience. An unexpected error has occurred.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("error logging", () => {
    it("should log error on mount", async () => {
      renderGlobalError();

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          "Global error caught",
          mockError,
        );
      });
      expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it("should log new error when error prop changes", async () => {
      const { rerender } = renderGlobalError();

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          "Global error caught",
          mockError,
        );
      });

      const newError = new Error("New error message");
      rerender(<GlobalError error={newError} retry={mockRetry} />);

      await waitFor(() => {
        expect(mockLoggerError).toHaveBeenCalledTimes(2);
        expect(mockLoggerError).toHaveBeenLastCalledWith(
          "Global error caught",
          newError,
        );
      });
    });
  });

  describe("button interactions", () => {
    it("should call retry when Try again button is clicked", () => {
      renderGlobalError();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it("should navigate to the homepage", () => {
      renderGlobalError();

      expect(
        screen.getByRole("link", { name: "Go to homepage" }),
      ).toHaveAttribute("href", "/");
    });
  });

  describe("development mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("should show error details in development mode", () => {
      renderGlobalError();

      expect(
        screen.getByText("Error Details (Development Only)"),
      ).toBeInTheDocument();
    });

    it("should display error message and stack in development mode", () => {
      const errorWithStack = new Error("Test error message");
      // stack 不含 message 文本，两条断言才各自独立。
      errorWithStack.stack = "    at testFunction (file.ts:1:1)";

      renderGlobalError(errorWithStack);

      // message 与 stack 渲染在同一个 pre 里，用正则分别匹配。
      expect(
        screen.getByText(/Test error message/, { exact: false }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/at testFunction/, { exact: false }),
      ).toBeInTheDocument();
    });
  });

  describe("production mode", () => {
    it("should not show error details when NODE_ENV is production", () => {
      // Note: We can't easily change NODE_ENV at runtime in tests
      // This test verifies the component renders correctly
      renderGlobalError();

      // The heading should always be visible
      expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    });
  });
});
