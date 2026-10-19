import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import CatchAllNotFound, {
  generateMetadata,
  generateStaticParams,
} from "../page";

describe("CatchAllNotFound", () => {
  it("returns placeholder static params for every locale", () => {
    expect(generateStaticParams()).toEqual(
      routing.locales.map((locale) => ({
        locale,
        rest: ["__not-found-placeholder"],
      })),
    );
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

  it("titles the 404 page as not found instead of inheriting the home title", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "es" }),
    });

    expect(metadata.title).toBe("Página no encontrada");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
