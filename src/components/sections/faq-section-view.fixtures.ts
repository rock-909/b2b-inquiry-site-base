import type { FaqSectionItem } from "@/components/sections/faq-section-view";

// Storybook 用的样例问答，作用是看 FAQ 区块的排版，不是站点真实文案的副本。上线
// 的 FAQ 在 `messages/profiles/catalog/en/messages.json` 和各页 MDX 的
// frontmatter 里。
//
// 原来这份写的是通用启动器时代的问答，问的是「上线前该替换哪些内容」「占位证明
// 能不能上线」，答的是让项目负责人来接手。那是别人产品的说明书，留在 `src/` 里
// 会让「启动器痕迹已经清干净」这句话不成立，所以换成这个站自己会被问到的问题。
export const sectionStoryFaqItems = [
  {
    key: "moq",
    question: "What is your minimum order?",
    answer:
      "It depends on the line. Boxwall starts at one carton and flood bags at 300; aluminum gates are quoted per opening schedule.",
  },
  {
    key: "samples",
    question: "Can I get a sample before placing a volume order?",
    answer:
      "Yes. Samples are paid and you cover freight, and the sample fee is credited against your first order.",
  },
] satisfies FaqSectionItem[];

export const sectionStoryFaqLongItems = [
  {
    key: "long-oem",
    question:
      "How does OEM and private label work across five product lines when we need one supplier, one QC standard, and our own branding on the packaging?",
    answer:
      "This long answer exists to check wrapping, spacing, and readability when a FAQ entry has to cover branding scope, artwork handover, sample approval, inspection rights, and lead time in one place rather than in a short sentence.",
  },
  ...sectionStoryFaqItems,
] satisfies FaqSectionItem[];

// CJK 排版档位。这不是语言档位：站点只出英文。中日韩字形是等宽全角、几乎没有
// 词间空格，折行点跟英文完全不同，所以同样内容在这个区块里会占不同的行数，
// `<summary>` 的换行位置也更容易出问题。`.claude/rules/ui.md` 要求长中文内容存在
// 溢出或折行风险时保留这类 story，就是为了这个。
export const sectionStoryFaqChineseItems = [
  {
    key: "zh-moq",
    question: "起订量是多少？",
    answer:
      "看产品线。箱式挡板一箱起订，防洪袋 300 个起订；铝合金闸门按开口清单报价。",
  },
  {
    key: "zh-samples",
    question: "批量下单前可以先要样品吗？",
    answer:
      "可以。样品付费、运费自理，样品费可抵扣首单货款。让你凭产品和规格表判断，而不是凭网站判断。",
  },
] satisfies FaqSectionItem[];
