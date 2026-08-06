import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";

const meta = {
  title: "UI/SectionHead",
  component: SectionHead,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    title: "Featured resources",
    subtitle:
      "Use this section to introduce a group of cards, links, or proof points.",
  },
} satisfies Meta<typeof SectionHead>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[640px]">
      <SectionHead {...args} />
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <div className="w-[720px]">
      <SectionHead
        title="Service categories"
        subtitle="Show a short summary first, then let visitors open the full catalog or contact flow."
        action={<Button variant="outline">View all</Button>}
      />
    </div>
  ),
};

export const LongChineseContent: Story = {
  render: () => (
    <div className="w-[520px]">
      <SectionHead
        title="页面模块标题"
        subtitle="这里用于检查较长中文说明在 section 标题区域中的换行、间距和按钮对齐表现。"
        action={<Button size="sm">查看说明</Button>}
      />
    </div>
  ),
};
