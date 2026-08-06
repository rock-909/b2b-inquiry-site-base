import { describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { resolveLocaleParam } from "@/i18n/locale-utils";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("resolveLocaleParam", () => {
  it("returns the locale when the route param is a configured locale", () => {
    expect(resolveLocaleParam({ locale: "en" })).toBe("en");
  });

  it("calls notFound for a retired locale", () => {
    expect(() => resolveLocaleParam({ locale: "zh" })).toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound for a value that is not a locale at all", () => {
    expect(() => resolveLocaleParam({ locale: "nope" })).toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
