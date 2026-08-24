import { describe, expect, it } from "vitest";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";

describe("home link targets", () => {
  it("uses inquiry as primary and about as secondary", () => {
    expect(SINGLE_SITE_HOME_LINK_TARGETS).toEqual({
      primaryCta: "/contact",
      secondaryCta: "/about",
      contact: "/contact",
      about: "/about",
    });
  });
});
