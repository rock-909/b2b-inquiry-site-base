import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusCallout } from "@/components/ui/status-callout";

describe("StatusCallout", () => {
  it("renders error tone as an assertive alert", () => {
    render(
      <StatusCallout tone="error" title="Submission failed">
        Please check the form and try again.
      </StatusCallout>,
    );

    const callout = screen.getByRole("alert");

    expect(callout).toHaveAttribute("aria-live", "assertive");
    expect(callout).toHaveAttribute("data-slot", "status-callout");
    expect(screen.getByText("Submission failed")).toBeInTheDocument();
    expect(
      screen.getByText("Please check the form and try again."),
    ).toBeInTheDocument();
  });

  it.each([
    ["success", "Saved successfully"],
    ["info", "We are preparing the form"],
  ] as const)("renders %s tone as a polite status", (tone, message) => {
    render(<StatusCallout tone={tone}>{message}</StatusCallout>);

    const callout = screen.getByRole("status");

    expect(callout).toHaveAttribute("aria-live", "polite");
    expect(callout).toHaveTextContent(message);
  });

  it("can render static notices without live-region semantics", () => {
    render(
      <StatusCallout live={false} title="Product context">
        Static buyer context.
      </StatusCallout>,
    );

    const callout = screen
      .getByText("Static buyer context.")
      .closest("[data-slot='status-callout']");

    expect(callout).toBeInTheDocument();
    expect(callout).not.toHaveAttribute("role");
    expect(callout).not.toHaveAttribute("aria-live");
  });
});
