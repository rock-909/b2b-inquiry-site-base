import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const meta = {
  title: "UI/Sheet",
  component: Sheet,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open details</Button>
      </SheetTrigger>
      <SheetContent closeLabel="Close sheet">
        <SheetHeader>
          <SheetTitle>Project details</SheetTitle>
          <SheetDescription>
            Review the product lines and send the openings you need to cover.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm text-muted-foreground">
          Add short guidance, navigation links, or a compact form here.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button>Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const OpenRight: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Open right sheet</Button>
      </SheetTrigger>
      <SheetContent side="right" closeLabel="Close sheet">
        <SheetHeader>
          <SheetTitle>Open sheet preview</SheetTitle>
          <SheetDescription>
            This story keeps the sheet open so layout can be reviewed without
            clicking first.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const SidePlacements: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(["left", "top", "bottom"] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline">Open {side}</Button>
          </SheetTrigger>
          <SheetContent side={side} closeLabel="Close sheet">
            <SheetHeader>
              <SheetTitle>{side} sheet</SheetTitle>
              <SheetDescription>
                Sheet content can slide from {side} when the flow needs it.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const LongChineseContent: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">打开中文说明</Button>
      </SheetTrigger>
      <SheetContent closeLabel="Close sheet">
        <SheetHeader>
          <SheetTitle>页面交接说明</SheetTitle>
          <SheetDescription>
            用于检查较长中文标题和描述在抽屉中的换行、间距和关闭按钮位置。
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
