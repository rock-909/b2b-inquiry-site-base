import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import {
  homepageStoryHero,
  homepageStoryHeroLongCopy,
} from "@/components/sections/hero-section-view.fixtures";
import { HeroSectionView } from "@/components/sections/hero-section-view";

const meta = {
  title: "Sections/HeroSection",
  component: HeroSectionView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    content: homepageStoryHero,
  },
} satisfies Meta<typeof HeroSectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongCopy: Story = {
  args: {
    content: homepageStoryHeroLongCopy,
  },
};

export const NarrowCanvas: Story = {
  args: {
    content: homepageStoryHeroLongCopy,
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
  parameters: {
    viewport: {
      options: MINIMAL_VIEWPORTS,
    },
  },
};
