import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "@/components/ui/separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
  args: {
    orientation: "horizontal",
  },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[360px] space-y-4">
      <p className="text-sm font-medium">Overview</p>
      <Separator />
      <p className="text-sm text-muted-foreground">
        Separates related content blocks without adding another card.
      </p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-4 text-sm">
      <span>Overview</span>
      <Separator orientation="vertical" />
      <span>Resources</span>
      <Separator orientation="vertical" />
      <span>Contact</span>
    </div>
  ),
};

export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: { default: "Dark" },
  },
  render: () => (
    <div className="w-[360px] rounded-xl bg-[var(--neutral-11)] p-6 text-white">
      <p className="text-sm font-medium">Dark surface</p>
      <Separator className="my-4 bg-white/20" />
      <p className="text-sm text-white/70">
        A custom class can tune contrast for dark review surfaces.
      </p>
    </div>
  ),
};
