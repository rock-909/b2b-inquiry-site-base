/**
 * @vitest-environment jsdom
 */

import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";
import { getFlatMessages, lookupMessage } from "@/test/i18n-messages";
import { createMockUseTranslations } from "@/test/utils";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(),
}));

// 模板不带二级菜单示例数据；这份带 groups 的导航只存在于测试里。
// 文案 key 必须是真实存在的 navigation key，取哪几个与断言无关。
vi.mock("@/config/single-site-navigation", () => ({
  SINGLE_SITE_NAVIGATION: [
    { key: "home", href: "/", messageKey: "home" },
    {
      key: "menu",
      messageKey: "language",
      groups: [
        {
          key: "group",
          messageKey: "siteDescription",
          links: [
            { key: "internal", href: "/contact", messageKey: "contactSales" },
            {
              key: "external",
              href: "https://example.com/catalog",
              messageKey: "home",
              external: true,
            },
          ],
        },
      ],
    },
  ],
}));

const messages = getFlatMessages();
const label = (key: string) => lookupMessage(messages, `navigation.${key}`);

function renderStatic(currentPathname?: string) {
  const html = renderToStaticMarkup(
    <MobileNavigationLinks
      {...(currentPathname === undefined ? {} : { currentPathname })}
    />,
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("MobileNavigationLinks with sub-items", () => {
  beforeEach(() => {
    vi.mocked(useTranslations).mockImplementation(
      createMockUseTranslations() as unknown as typeof useTranslations,
    );
  });

  it("renders a native, collapsed accordion whose grouped links are in the no-JS HTML", () => {
    const doc = renderStatic("/contact");
    const details = doc.querySelector("details");

    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe(
      label("language"),
    );

    const group = details?.querySelector(
      `ul[aria-label="${label("siteDescription")}"]`,
    );
    const links = [...(group?.querySelectorAll("a") ?? [])].map((link) => ({
      text: link.textContent,
      href: link.getAttribute("href"),
      target: link.getAttribute("target"),
      rel: link.getAttribute("rel"),
      current: link.getAttribute("aria-current"),
    }));
    expect(links).toEqual([
      {
        text: label("contactSales"),
        href: "/contact",
        target: null,
        rel: null,
        current: "page",
      },
      {
        text: `${label("home")}↗`,
        href: "https://example.com/catalog",
        target: "_blank",
        rel: "noopener noreferrer",
        current: null,
      },
    ]);
  });
});
