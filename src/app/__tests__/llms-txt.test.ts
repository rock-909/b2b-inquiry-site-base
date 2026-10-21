import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms.txt/route";
import sitemap from "@/app/sitemap";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

describe("llms.txt", () => {
  it("lists exactly the sitemap's indexable URLs", async () => {
    const response = GET();
    const body = await response.text();
    const links = [...body.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gmu)].map(
      (match) => match[1]!,
    );

    expect(response.headers.get("content-type")).toMatch(/^text\/plain/u);
    expect(body.split("\n")[0]).toBe(`# ${SINGLE_SITE_CONFIG.name}`);
    // noindex 页面（如占位法务页）不应出现；纳入 sitemap 后自动列出。
    expect(links).toEqual((await sitemap()).map((entry) => entry.url));
    expect(new URL(links[0]!).pathname).toBe("/");
  });
});
