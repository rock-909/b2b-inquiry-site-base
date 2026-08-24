import { describe, expect, it } from "vitest";
import { SINGLE_SITE_FOOTER_COLUMNS } from "@/config/single-site";

describe("footer links", () => {
  it("contains only core navigation and support links", () => {
    expect(
      SINGLE_SITE_FOOTER_COLUMNS.map((column) => ({
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
          ["privacy", "/privacy"],
          ["terms", "/terms"],
        ],
      },
    ]);
  });
});
