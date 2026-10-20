import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { getFlatMessages } from "@/test/i18n-messages";
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
    // 有第二语言时用它，证明标题按请求语言取文案；否则退回默认语言。
    const locale =
      routing.locales.find((entry) => entry !== routing.defaultLocale) ??
      routing.defaultLocale;
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale }),
    });

    expect(metadata.title).toBe(
      getFlatMessages(locale).get("errors.notFound.title"),
    );
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
