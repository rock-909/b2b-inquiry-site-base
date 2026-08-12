import { describe, expect, it } from "vitest";
import { FOOTER_COLUMNS } from "@/config/footer-links";
import { getSingleSiteFooterColumns } from "@/config/single-site";

describe("footer links", () => {
  it("contains only core navigation and support links", () => {
    expect(FOOTER_COLUMNS).toEqual(getSingleSiteFooterColumns());
    expect(
      FOOTER_COLUMNS.map((column) => ({
        key: column.key,
        links: column.links.map((link) => [link.key, link.href]),
      })),
    ).toEqual([
      {
        key: "navigation",
        links: [
          ["home", "/"],
          ["products", "/products"],
          ["about", "/about"],
          ["contact", "/contact"],
        ],
      },
      {
        key: "support",
        links: [
          ["requestQuote", "/request-quote"],
          ["privacy", "/privacy"],
          ["terms", "/terms"],
        ],
      },
    ]);
  });
});
