import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { SINGLE_SITE_FOOTER_COLUMNS } from "@/config/single-site";

// 预期集合跟随页面注册表：派生站合法删掉 Terms 时这里不用改。
const LEGAL_PAGE_TYPES: readonly string[] = ["privacy", "terms"];

describe("footer links", () => {
  it("lists navigation pages in registry order, then the registered legal pages", () => {
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
        links: PUBLIC_STATIC_PAGE_DEFINITIONS.filter((page) =>
          LEGAL_PAGE_TYPES.includes(page.pageType),
        ).map((page) => [page.pageType, page.path]),
      },
    ]);
    // 独立锚点：导航列第一项是首页，法务列第一项是隐私政策，两列都不能为空。
    expect(columns[0]?.links[0]).toEqual(["home", "/"]);
    expect(columns[1]?.links[0]).toEqual(["privacy", "/privacy"]);
  });
});
