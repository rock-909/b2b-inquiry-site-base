import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PageType } from "@/config/paths";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  PUBLIC_STATIC_PAGE_TYPES,
} from "@/config/pages.config";

const REPO_ROOT = process.cwd();

function expectStaticRouteOwner(routeOwner: string): void {
  expect(routeOwner.startsWith("src/app/[locale]/")).toBe(true);
  expect(routeOwner.endsWith("page.tsx")).toBe(true);

  const relativePath = routeOwner.slice("src/app/[locale]/".length);
  const segments = relativePath.split("/");
  expect(segments.at(-1)).toBe("page.tsx");

  const routeSegments = segments.slice(0, -1);
  const allowedCharacters = "abcdefghijklmnopqrstuvwxyz0123456789-";
  for (const segment of routeSegments) {
    expect(segment.length).toBeGreaterThan(0);
    for (const character of segment) {
      expect(allowedCharacters).toContain(character);
    }
  }
}

describe("static public pages architecture contract", () => {
  it("keeps route owners static, literal, and backed by real files", () => {
    for (const definition of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      expectStaticRouteOwner(definition.routeOwner);
      expect(definition.routeOwner).not.toContain("[market]");
      expect(definition.routeOwner).not.toContain("[slug]");
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local routeOwner paths from the registry contract
      expect(existsSync(join(REPO_ROOT, definition.routeOwner))).toBe(true);
    }
  });

  // 上一条把 `routeOwner` 同时当成「被检查的配置」和「要检查的路径」，所以只要
  // 改成另一个真实存在的 page.tsx 就照样绿，`/products` 指到首页也发现不了。
  //
  // 这条只管一件事：URL 和 owner 目录必须对得上。它自己不是独立真值，两个字段
  // 一起改错它也是绿的。真值在 `tucsenberg-site-contract.test.ts` 的
  // `TARGET_STATIC_PATHS`——那份 URL 清单是手写的，注册表改了 URL 它会红。两条
  // 合起来才封住：一条钉 URL，一条钉 URL 到文件的映射。
  it("puts each route owner where the page's own URL says it should be", () => {
    for (const definition of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      const englishPath = definition.localizedPaths.en;
      const routeDirectory =
        englishPath === "/" ? "" : `${englishPath.slice(1)}/`;

      expect(definition.routeOwner, englishPath).toBe(
        `src/app/[locale]/${routeDirectory}page.tsx`,
      );
    }
  });

  it("keeps the current PageType set represented by the registry", () => {
    const expected = [
      "home",
      "products",
      "oemWholesale",
      "materialsGuide",
      "specificationsGuide",
      "about",
      "requestQuote",
      "contact",
      "warranty",
      "privacy",
      "terms",
    ] as const satisfies readonly PageType[];

    expect(PUBLIC_STATIC_PAGE_TYPES).toEqual(expected);
  });
});
