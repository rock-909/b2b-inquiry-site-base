import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../card";

describe("Card", () => {
  it("keeps its slot and a caller's className", () => {
    render(
      <Card className="custom-card" data-testid="card">
        Card Content
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card).toHaveClass("custom-card", "surface-card");
  });
});
