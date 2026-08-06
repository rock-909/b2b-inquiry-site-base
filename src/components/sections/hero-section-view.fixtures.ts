import type { HeroSectionContent } from "@/components/sections/hero-section-view";
import { ABS_FLOOD_BARRIERS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-abs-flood-barriers";
import { TB_BW_HEIGHT_RANGE } from "@/constants/tucsenberg-product-spec-values";

const boxwallDiagramLabels =
  ABS_FLOOD_BARRIERS_PRODUCT_PAGE.diagram?.kind === "boxwall"
    ? ABS_FLOOD_BARRIERS_PRODUCT_PAGE.diagram.labels
    : {
        waterSide: "water side",
        loadSealsBase: "load seals the base",
        profile: "interlocking ABS unit — freestanding L-profile",
        load: "LOAD",
        floodSide: "FLOOD SIDE",
        drySide: "DRY SIDE",
        heightRange: TB_BW_HEIGHT_RANGE.label,
      };

// Storybook 用的样例内容，作用是看排版，不是站点真实文案的副本。上线的首页
// hero 文案在 `messages/profiles/catalog/en/messages.json`，由
// `tests/architecture/tucsenberg-site-contract.test.ts` 逐字钉住；这里写的东西
// 改了不影响买家看到的页面，所以别把它当真值来引用。
//
// 原来这份写的是通用启动器时代的占位文案，眉题直接是那套模板的名字，正文让人
// "等真实公司接手后再替换"。那些字符串是别人的品牌，留在 `src/` 里会让
// "启动器痕迹已经清干净"这句话不成立，所以换成这个站自己的话。这里刻意不复述
// 原文：架构测试扫的是源码文本，注释里抄一遍等于把它又种回去。
export const homepageStoryHero = {
  eyebrow: "Factory-direct flood barriers",
  title: "Five flood barrier product lines from one coordinated factory pool.",
  subtitle:
    "ABS boxwall, aluminum flood gates, absorbent flood bags, tube dams, and FRP planks — one QC standard, OEM and private label available.",
  primaryCta: { label: "View product lines", href: "/products" },
  secondaryCta: { label: "Request a quote", href: "/request-quote" },
  proofAriaLabel: "Homepage proof categories",
  proofItems: [
    { value: "5", label: "product lines" },
    { value: "OEM", label: "and private label" },
    { value: "1", label: "QC standard" },
    { value: "12h", label: "reply window" },
  ],
  diagram: {
    kind: "boxwall",
    labels: boxwallDiagramLabels,
    panelLabel: "PRODUCT PRINCIPLE",
    ariaLabel: "ABS boxwall working-principle line drawing",
    caption:
      "Interlocking ABS units; water load seals the base against the ground.",
  },
} satisfies HeroSectionContent;

// 长文案档位，专门用来看 hero 在长句子下会不会把 CTA 行、预览卡或证明条挤坏。
export const homepageStoryHeroLongCopy = {
  ...homepageStoryHero,
  title:
    "Five flood barrier product lines from one coordinated factory pool, covering doorway openings, loading bays, underground ramps, and temporary perimeter defence on a single QC standard.",
  subtitle:
    "This long-copy story checks whether the hero can handle real-world descriptions without crushing the CTA row, preview card, or proof strip on narrower screens.",
} satisfies HeroSectionContent;
