import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";

const meta = {
  title: "UI/ThemeSwitcher",
  component: ThemeSwitcher,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">Theme</span>
      <ThemeSwitcher />
    </div>
  ),
};

export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: { default: "Dark" },
  },
  render: () => (
    <div className="rounded-xl bg-[var(--neutral-11)] p-6">
      <ThemeSwitcher className="bg-background" />
    </div>
  ),
};
