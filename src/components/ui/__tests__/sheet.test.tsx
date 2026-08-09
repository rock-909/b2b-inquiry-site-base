/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../sheet";

vi.mock("lucide-react", () => ({
  XIcon: ({ className, ...props }: React.ComponentProps<"svg">) => (
    <svg data-testid="x-icon" className={className} {...props} />
  ),
}));

describe("Sheet", () => {
  it("renders trigger and opens content on click", async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger data-testid="trigger">Open Sheet</SheetTrigger>
        <SheetContent closeLabel="Close sheet" data-testid="content">
          <SheetTitle>Sheet Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  it("renders text subcomponents with data slots and merged classes", async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent closeLabel="Close sheet">
          <SheetHeader className="custom-header" data-testid="header">
            <SheetTitle className="custom-title">Header Title</SheetTitle>
            <SheetDescription>Header Description</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("header")).toHaveAttribute(
        "data-slot",
        "sheet-header",
      );
      expect(screen.getByTestId("header")).toHaveClass("p-4", "custom-header");
      expect(screen.getByText("Header Title")).toHaveClass(
        "font-semibold",
        "custom-title",
      );
      expect(screen.getByText("Header Description")).toHaveAttribute(
        "data-slot",
        "sheet-description",
      );
    });
  });
});
