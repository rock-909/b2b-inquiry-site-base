import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusCallout } from "@/components/ui/status-callout";

const meta = {
  title: "UI/StatusCallout",
  component: StatusCallout,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusCallout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "A short status message for the current step.",
    title: "Status update",
    tone: "info",
  },
};

export const Warning: Story = {
  args: {
    children:
      "Confirm the product family and buyer region before submitting this inquiry.",
    title: "Review before sending",
    tone: "warning",
  },
};

export const Success: Story = {
  args: {
    children:
      "The team can now review the request and follow up with the buyer.",
    title: "Inquiry received",
    tone: "success",
  },
};

export const Error: Story = {
  args: {
    children: "Please check the highlighted fields and try again.",
    title: "Submission failed",
    tone: "error",
  },
};

export const LongChineseContent: Story = {
  args: {
    children:
      "用于检查较长中文状态说明在 StatusCallout 中的换行、间距和标题对齐表现。",
    title: "状态提示标题",
    tone: "warning",
  },
};
