import { describe, expect, it, vi } from "vitest";
import CatchAllNotFound, { generateStaticParams } from "../page";

const { mockNotFound } = vi.hoisted(() => ({
  mockNotFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en"],
  },
}));

describe("CatchAllNotFound", () => {
  it("returns placeholder static params for every locale", () => {
    expect(generateStaticParams()).toEqual([
      { locale: "en", rest: ["__not-found-placeholder"] },
    ]);
  });

  it("delegates unmatched localized paths to the segment not-found boundary", () => {
    CatchAllNotFound();

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
