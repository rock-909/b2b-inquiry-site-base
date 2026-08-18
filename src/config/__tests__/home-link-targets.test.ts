import { describe, expect, it } from "vitest";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";

describe("home link targets", () => {
  it("uses inquiry as primary and about as secondary", () => {
    expect(SINGLE_SITE_HOME_LINK_TARGETS).toEqual({
      primaryCta: "/request-quote",
      secondaryCta: "/about",
      contact: "/contact",
      requestQuote: "/request-quote",
      about: "/about",
    });
  });
});
