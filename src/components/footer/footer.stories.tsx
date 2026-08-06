import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Footer } from "@/components/footer/footer";

const meta = {
  title: "Footer/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Footer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithThemeToggleSlot: Story = {
  args: {
    themeToggleSlot: (
      <button
        className="rounded-md border border-border px-3 py-1 text-sm"
        type="button"
      >
        Theme control slot
      </button>
    ),
  },
};

export const DarkSurface: Story = {
  args: {
    dataTheme: "dark",
  },
  parameters: {
    backgrounds: { default: "Dark" },
  },
};
