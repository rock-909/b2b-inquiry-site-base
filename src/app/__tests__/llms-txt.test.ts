import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms.txt/route";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { getLocalePath, LOCALES_CONFIG } from "@/config/paths";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

describe("llms.txt", () => {
  it("lists every public registry page in every locale with absolute URLs", async () => {
    const response = GET();
    const body = await response.text();
    const links = [...body.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gmu)].map(
      (match) => new URL(match[1]!),
    );

    expect(response.headers.get("content-type")).toMatch(/^text\/plain/u);
    expect(body.split("\n")[0]).toBe(`# ${SINGLE_SITE_CONFIG.name}`);
    for (const url of links) {
      expect(url.origin).toBe(new URL(SINGLE_SITE_CONFIG.baseUrl).origin);
    }
    // 不按 sitemap 过滤：隐私、条款等公开页面也要列出。
    expect(links.map((url) => url.pathname)).toEqual(
      LOCALES_CONFIG.locales.flatMap((locale) =>
        PUBLIC_STATIC_PAGE_DEFINITIONS.map((page) =>
          getLocalePath(locale, page.path),
        ),
      ),
    );
    expect(links[0]?.pathname).toBe("/");
  });
});
