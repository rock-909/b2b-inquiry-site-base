/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setIntersectionAutoVisibleAll, triggerVisible } from "@/test/setup";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";
import { DeferredInquiryForm } from "../deferred-inquiry-form";

describe("DeferredInquiryForm", () => {
  beforeEach(() => setIntersectionAutoVisibleAll(false));
  afterEach(() => setIntersectionAutoVisibleAll(true));

  it("keeps the fallback until the form boundary becomes visible", async () => {
    const copy = createTestInquiryFormCopy();
    render(
      <DeferredInquiryForm
        copy={copy}
        fallback={<div data-testid="deferred-fallback">Fallback</div>}
      />,
    );

    expect(screen.getByTestId("deferred-fallback")).toBeInTheDocument();
    const boundary = screen.getByTestId("deferred-fallback").parentElement;
    expect(boundary).not.toBeNull();

    await act(async () => {
      triggerVisible(boundary!);
      await vi.dynamicImportSettled();
    });

    expect(await screen.findByTestId("inquiry-form")).toBeInTheDocument();
    expect(screen.queryByTestId("deferred-fallback")).not.toBeInTheDocument();
  });
});
