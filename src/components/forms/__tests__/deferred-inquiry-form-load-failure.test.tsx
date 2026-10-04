/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";
import { DeferredInquiryForm } from "../deferred-inquiry-form";

vi.mock("@/components/forms/inquiry-form", () => {
  throw new Error("simulated chunk load failure");
});

describe("DeferredInquiryForm when the form chunk fails to load", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the page and shows the static fallback instead of throwing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await act(async () => {
      render(
        <DeferredInquiryForm
          copy={createTestInquiryFormCopy()}
          fallback={<div data-testid="deferred-fallback">Fallback</div>}
        />,
      );
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("deferred-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("inquiry-form")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
