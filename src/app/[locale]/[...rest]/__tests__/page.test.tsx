import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CatchAllNotFound, { generateStaticParams } from "../page";

describe("CatchAllNotFound", () => {
  it("returns placeholder static params for every locale", () => {
    expect(generateStaticParams()).toEqual([
      { locale: "en", rest: ["__not-found-placeholder"] },
      { locale: "es", rest: ["__not-found-placeholder"] },
    ]);
  });

  it("renders recovery content without throwing to a client boundary", async () => {
    render(
      await CatchAllNotFound({
        params: Promise.resolve({
          locale: "en",
          rest: ["__not-found-placeholder"],
        }),
      }),
    );

    expect(screen.getByText("404", { exact: true })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to homepage" }),
    ).toHaveAttribute("href", "/");
  });
});
