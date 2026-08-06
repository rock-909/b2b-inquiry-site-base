import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogMessages from "../../../../messages/profiles/catalog/en/messages.json";
import {
  SINGLE_SITE_HOME_BUYER_SEGMENT_KEYS,
  SINGLE_SITE_HOME_PRODUCT_LINES,
  SINGLE_SITE_HOME_SECTION_ORDER,
  SINGLE_SITE_HOME_VERIFY_ITEM_KEYS,
} from "@/config/single-site-page-expression";
import Home, { generateMetadata, generateStaticParams } from "../page";

// 这个文件原来手写了一份 104 条的首页文案清单，并本地 mock 掉 `next-intl/server`
// 去喂它。清单里的 hero 和 finalCta 文案在真实消息包里根本不存在：线上首页 h1 是
// "Factory-Direct Flood Barriers from China"，清单里写的是启动器时代的 "Present
// products, applications, and delivery proof..."。这些 key 上的断言证明的是虚构
// 文案，改真实文案不会变红——`.claude/rules/testing.md` 禁止手写测试文案清单，
// 就是为了防这个。（清单里 product / buyer 那几项当时跟真实消息包是一致的，不是
// 每一条断言都建立在虚构文案上。）
//
// 现在走全局 mock（`src/test/setup.constants-and-i18n.ts`），它读生产同源的合成
// 消息包。要引用文案时从 `catalogMessages` 取。这类派生断言只证明 key 接线正确，
// 不判断文案该是什么；逐字真值在 `tests/architecture/tucsenberg-site-contract.test.ts`
// 手写钉住（hero.title、五条产品线标题、四类买家标题都在那里）。
//
// 循环一律走生产配置的键集合，不走「消息包现在有什么」。消息包里少一项时，
// 按消息包循环会静默少断一项；按配置循环则会去取一个不存在的 key 而失败——
// 而生产页面正是按配置去请求这些 key 的。
const homeCopy = catalogMessages.home;

const mockGetSingleSiteHomeLinkTargets = vi.hoisted(() =>
  vi.fn(() => ({
    contact: "/contact",
    products: "/products",
    requestQuote: "/request-quote",
    oemWholesale: "/oem-wholesale",
    primaryCta: "/request-quote",
    secondaryCta: "/oem-wholesale",
  })),
);

// 这里原来本地 mock 了 `@/i18n/routing`，把 locales 写成 `["en", "zh"]`，然后
// 下面断言 generateStaticParams 返回 en 和 zh——断的是自己刚写下的 mock，站点
// 真实语言集合是什么它不看，而 zh 早已退役。它确实顺带覆盖了「每个 locale 都要
// 映射一遍」这个行为，那部分覆盖搬到了
// `src/app/[locale]/__tests__/generate-static-params.test.ts`。
//
// 全局 setup 已经 mock 了这个模块，locales 是 `["en"]`，Link 也有。
vi.mock("@/config/single-site-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/single-site-links")>()),
  getSingleSiteHomeLinkTargets: mockGetSingleSiteHomeLinkTargets,
}));

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: () => <script type="application/ld+json" />,
  JsonLdScript: () => <script type="application/ld+json" />,
}));

// Hero 必须 mock：它是 async Server Component，RTL 渲染不了 async 子组件（会报
// "is an async Client Component"）。它自己的文案、h1 和原理图由
// `src/components/sections/__tests__/hero-section.test.tsx` 渲染真实组件、比对
// 真实消息包来守（h1 在第 43 行，图注在第 66 行；把 hero.title 接线改成
// hero.subtitle 会让那两条变红，已验证）。
//
// 但 mock 出来的壳不能用来断内容。原来这里断的是 mock 自己写死的 h1 和图注，
// 于是把 page.tsx 里的 `<HeroSection />` 换成一个同 testid 的空 section 也不会
// 红——两边的邻居测试各自还绿着，中间「首页装的是 Hero 组件」这个连接却断了。
// 所以这里改成数它被渲染了几次：空壳会让计数停在 0。
//
// 计数器在整个文件里是同一个对象，必须每个用例前归零。不归零的话它只是碰巧绿：
// 这个文件里好几个用例都会 render(Home)，`toBe(1)` 能过全靠数它的那条恰好第一个
// 跑到，在它前面多插一次渲染就会红。
const heroSectionRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/components/sections/hero-section", () => ({
  HeroSection: () => {
    heroSectionRenders.count += 1;
    return <section data-testid="hero-section" />;
  },
}));

describe("Home Page", () => {
  beforeEach(() => {
    heroSectionRenders.count = 0;
    mockGetSingleSiteHomeLinkTargets.mockReturnValue({
      contact: "/contact",
      products: "/products",
      requestQuote: "/request-quote",
      oemWholesale: "/oem-wholesale",
      primaryCta: "/request-quote",
      secondaryCta: "/oem-wholesale",
    });
  });

  describe("generateStaticParams", () => {
    // 期望值手写，不从 routing 反推。这条自己不是独立真值——它读的是全局 mock；
    // 真值在 `tests/architecture/tucsenberg-site-contract.test.ts`，那里手写钉住
    // `LOCALES_CONFIG.locales` 等于 `["en"]`、`retiredLocales` 等于 `["zh"]`。
    // 两条合起来才封住：一条钉语言集合是什么，这条钉首页会为它们预生成页面。
    // 这条钉的是「现在只有 en」，它抓不到 `routing.locales.slice(0, 1)` 这类
    // 改动：集合里只有一个元素时，截断和不截断的结果一模一样。「每个 locale 都
    // 要映射一遍」由 `generate-static-params.test.ts` 单独守着。
    it("prerenders one params entry per shipped locale", () => {
      expect(generateStaticParams()).toEqual([{ locale: "en" }]);
    });
  });

  describe("generateMetadata", () => {
    it("uses the owner-approved source meta description, not the hero subtitle", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ locale: "en" }),
      });

      expect(metadata.title).toBe(
        "Flood Barrier Manufacturer & Supplier from China | Tucsenberg",
      );
      expect(metadata.description).toBe(
        "Factory-direct flood barriers from China: ABS boxwall, aluminum flood gates, sandless flood bags and tube dams. OEM & private label. Reply within 12 hours.",
      );
      expect(metadata.description).not.toBe(homeCopy.hero.subtitle);
    });
  });

  describe("Home Component", () => {
    it("should explain the B2B evaluation copy across the homepage sections", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      render(HomeComponent);

      // 两条一起才够：计数管「装的是 HeroSection 组件本身，不是同 testid 的空
      // section」，可见性管「买家真能看到它」。只数调用次数的话，把它包进
      // `<div hidden>` 或 `display:none` 里计数仍是 1，而章节顺序断言走
      // querySelectorAll 也不排除隐藏节点，两条都会绿。
      expect(heroSectionRenders.count).toBe(1);
      expect(screen.getByTestId("hero-section")).toBeVisible();
      expect(
        screen.getByTestId("home-product-lines-section"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("home-buying-process-section"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("home-final-action")).toBeInTheDocument();
      const productLinesSection = within(
        screen.getByTestId("home-product-lines-section"),
      );
      for (const { key } of SINGLE_SITE_HOME_PRODUCT_LINES) {
        expect(
          productLinesSection.getByText(homeCopy.productLines.items[key].title),
        ).toBeInTheDocument();
      }
      const buyerSegmentsSection = within(
        screen.getByTestId("home-buyer-segments-section"),
      );
      for (const key of SINGLE_SITE_HOME_BUYER_SEGMENT_KEYS) {
        expect(
          buyerSegmentsSection.getByText(
            homeCopy.buyerSegments.items[key].title,
          ),
        ).toBeInTheDocument();
      }
      const verifySection = within(screen.getByTestId("home-verify-section"));
      for (const key of SINGLE_SITE_HOME_VERIFY_ITEM_KEYS) {
        expect(
          verifySection.getByText(homeCopy.verify.items[key].title),
        ).toBeInTheDocument();
      }
    });

    it("renders homepage sections in the configured page-expression order", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      const { container } = render(HomeComponent);

      const sectionTestIds = {
        hero: "hero-section",
        productLines: "home-product-lines-section",
        howToChoose: "home-how-to-choose-section",
        buyingProcess: "home-buying-process-section",
        buyerSegments: "home-buyer-segments-section",
        verify: "home-verify-section",
        faq: "home-faq-section",
        finalCta: "home-final-action",
      } as const;
      const expectedOrder = SINGLE_SITE_HOME_SECTION_ORDER.map(
        (section) => sectionTestIds[section],
      );
      const sectionSelector = expectedOrder
        .map((testId) => `[data-testid="${testId}"]`)
        .join(",");
      const renderedOrder = Array.from(
        container.querySelectorAll<HTMLElement>(sectionSelector),
      ).map((section) => section.dataset.testid);

      expect(renderedOrder).toEqual(expectedOrder);
    });

    it("keeps final CTA labels attached to matching route meanings", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      render(HomeComponent);

      const finalAction = within(screen.getByTestId("home-final-action"));
      expect(
        finalAction.getByRole("link", { name: "Request a Quote" }),
      ).toHaveAttribute("href", "/request-quote");
      expect(
        finalAction.getByRole("link", { name: "Wholesale & OEM" }),
      ).toHaveAttribute("href", "/oem-wholesale");
    });

    it("keeps the first supporting sections structured as B2B proof panels", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      render(HomeComponent);

      const productLinesSection = screen.getByTestId(
        "home-product-lines-section",
      );
      const buyerSegmentsSection = screen.getByTestId(
        "home-buyer-segments-section",
      );
      const buyingProcessSection = screen.getByTestId(
        "home-buying-process-section",
      );

      expect(productLinesSection).toHaveClass("section-divider");
      expect(buyerSegmentsSection).toHaveClass("section-divider");
      expect(buyingProcessSection).toHaveClass("section-divider");

      const productLineArticles =
        within(productLinesSection).getAllByRole("article");
      expect(productLineArticles[0]).toHaveClass("surface-card");

      const buyerSegmentsProofPanel = within(buyerSegmentsSection).getByTestId(
        "home-buyer-segments-proof-panel",
      );
      expect(buyerSegmentsProofPanel).not.toHaveClass("surface-card");
      expect(buyerSegmentsProofPanel).toHaveClass("grid");
      expect(
        within(buyerSegmentsProofPanel).getAllByTestId(
          "home-buyer-segments-proof-item",
        )[0],
      ).toHaveClass("rounded-xl");

      const buyingProcessList = within(buyingProcessSection).getByRole("list");
      expect(buyingProcessList).toHaveClass("divide-y");
      expect(buyingProcessList).not.toHaveClass("grid");
      expect(
        within(buyingProcessList).getAllByTestId(
          "home-buying-process-step-badge",
        )[0],
      ).toHaveClass("rounded-full");
    });

    it("should have correct container classes", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      const { container } = render(HomeComponent);
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass(
        "min-h-dvh",
        "bg-background",
        "text-foreground",
      );
    });

    it("should be an async server component", async () => {
      const result = Home({ params: Promise.resolve({ locale: "en" }) });
      expect(result).toBeInstanceOf(Promise);
    });

    it("should handle delayed params resolution", async () => {
      const delayedParams = new Promise<{ locale: "en" }>((resolve) =>
        setTimeout(() => resolve({ locale: "en" }), 10),
      );

      const HomeComponent = await Home({ params: delayedParams });
      expect(HomeComponent).toBeDefined();
    });

    it("should handle params rejection", async () => {
      const rejectedParams = Promise.reject(new Error("Params error"));

      await expect(Home({ params: rejectedParams })).rejects.toThrow(
        "Params error",
      );
    });
  });
});
