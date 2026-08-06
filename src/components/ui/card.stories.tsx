import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>
          Short supporting description for the card header area.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Wrapper-level body content for marketing or narrative cards.
        </p>
      </CardContent>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card with action slot</CardTitle>
        <CardDescription>
          Shows header action, body content, and footer together.
        </CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground">Status</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>First detail line</li>
          <li>Second detail line</li>
          <li>Third detail line</li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button size="sm">Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const LongChineseContent: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>产品线展示卡片</CardTitle>
        <CardDescription>
          用于检查中文标题、描述和按钮组合在卡片中的换行表现。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          用于检查中文长文案、重点信息和卡片布局在不同宽度下的表现。
        </p>
      </CardContent>
    </Card>
  ),
};
