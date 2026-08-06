import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "ghost",
        "link",
        "accent",
        "destructive",
        "on-dark",
        "ghost-dark",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
  args: {
    children: "Request a quote",
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Request a quote</Button>
      <Button variant="secondary">View products</Button>
      <Button variant="outline">Download catalog</Button>
      <Button variant="accent">Project support</Button>
      <Button variant="destructive">Remove draft</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Continue">
        <ArrowRight />
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Turnstile required",
  },
};

export const LongChineseContent: Story = {
  render: () => (
    <div className="max-w-xs">
      <Button className="w-full">提交项目需求并预约下一步沟通</Button>
    </div>
  ),
};

export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: { default: "Dark" },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--neutral-11)] p-6">
      <Button variant="on-dark">Start project</Button>
      <Button variant="ghost-dark">Book consultation</Button>
    </div>
  ),
};
