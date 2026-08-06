import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FaqSectionView } from "@/components/sections/faq-section-view";
import {
  sectionStoryFaqChineseItems,
  sectionStoryFaqItems,
  sectionStoryFaqLongItems,
} from "@/components/sections/faq-section-view.fixtures";

const meta = {
  title: "Sections/FaqSectionView",
  component: FaqSectionView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    title: "Frequently asked questions",
    subtitle:
      "Minimums, samples, OEM scope, and lead time — the questions buyers send first.",
    items: sectionStoryFaqItems,
  },
} satisfies Meta<typeof FaqSectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongAnswers: Story = {
  args: {
    title:
      "Frequently asked questions about minimum order quantities, paid samples, OEM and private label scope, factory audits, and production lead time",
    items: sectionStoryFaqLongItems,
  },
};

export const ChineseCopy: Story = {
  args: {
    title: "常见问题",
    subtitle: "起订量、样品、贴牌范围和交期，买家最先问的几件事。",
    items: sectionStoryFaqChineseItems,
  },
};

export const WithoutJsonLd: Story = {};
