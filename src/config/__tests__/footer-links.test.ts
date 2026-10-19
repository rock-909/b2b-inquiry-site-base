import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { SINGLE_SITE_FOOTER_COLUMNS } from "@/config/single-site";

describe("footer links", () => {
  it("lists navigation pages in registry order, then the two legal pages", () => {
    const columns = SINGLE_SITE_FOOTER_COLUMNS.map((column) => ({
      key: column.key,
      links: column.links.map((link) => [link.key, link.href]),
    }));

    expect(columns).toEqual([
      {
        key: "navigation",
        links: PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
          (page) => page.navigationKey !== null,
        ).map((page) => [page.pageType, page.path]),
      },
      {
        key: "support",
        links: [
          ["privacy", "/privacy"],
          ["terms", "/terms"],
        ],
      },
    ]);
    // 独立锚点：页脚导航第一项是首页。
    expect(columns[0]?.links[0]).toEqual(["home", "/"]);
  });
});
