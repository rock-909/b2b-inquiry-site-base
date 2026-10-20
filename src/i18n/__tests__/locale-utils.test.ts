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

  it.each(["zh", "nope"])(
    "calls notFound for unsupported locale %s",
    (locale) => {
      expect(() => resolveLocaleParam({ locale })).toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalled();
    },
  );
});
