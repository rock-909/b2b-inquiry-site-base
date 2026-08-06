import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FaqAccordion } from "@/components/sections/faq-accordion";
import {
  sectionStoryFaqChineseItems,
  sectionStoryFaqItems,
  sectionStoryFaqLongItems,
} from "@/components/sections/faq-section-view.fixtures";

const manyItems = [
  ...sectionStoryFaqItems,
  {
    key: "workflow",
    question: "Who confirms the spec before production starts?",
    answer:
      "You approve the paid sample and the spec sheet; both are written into the quotation.",
  },
  {
    key: "storybook",
    question: "Why review components in Storybook?",
    answer: "Storybook makes long copy and visual states easy to inspect.",
  },
];

const meta = {
  title: "Sections/FaqAccordion",
  component: FaqAccordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    items: sectionStoryFaqItems,
  },
} satisfies Meta<typeof FaqAccordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongAnswers: Story = {
  args: {
    items: sectionStoryFaqLongItems,
  },
};

export const ChineseCopy: Story = {
  args: {
    items: sectionStoryFaqChineseItems,
  },
};

export const ManyItems: Story = {
  args: {
    items: manyItems,
  },
};
