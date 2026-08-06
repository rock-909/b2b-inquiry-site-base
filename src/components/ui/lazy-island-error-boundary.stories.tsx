import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { LazyIslandErrorBoundary } from "@/components/ui/lazy-island-error-boundary";

function ControlledBrokenIsland({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Controlled Storybook island error");
  }

  return (
    <div className="rounded-xl border bg-card p-4 text-sm text-card-foreground">
      Optional island loaded. This area can fail without taking down the parent
      section.
    </div>
  );
}

function ControlledBoundaryExample() {
  const [shouldThrow, setShouldThrow] = useState(false);

  return (
    <div className="w-[380px] space-y-4">
      <Button variant="outline" onClick={() => setShouldThrow(true)}>
        Show fallback
      </Button>
      <LazyIslandErrorBoundary
        fallback={
          <div className="rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
            The optional preview could not load. The rest of the page still
            works.
          </div>
        }
      >
        <ControlledBrokenIsland shouldThrow={shouldThrow} />
      </LazyIslandErrorBoundary>
    </div>
  );
}

const meta = {
  title: "UI/LazyIslandErrorBoundary",
  component: LazyIslandErrorBoundary,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    children: (
      <div className="rounded-xl border bg-card p-4 text-sm text-card-foreground">
        Lazy island content rendered normally.
      </div>
    ),
  },
} satisfies Meta<typeof LazyIslandErrorBoundary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <LazyIslandErrorBoundary>
      <div className="w-[360px] rounded-xl border bg-card p-4 text-sm text-card-foreground">
        Lazy island content rendered normally.
      </div>
    </LazyIslandErrorBoundary>
  ),
};

export const ControlledFallback: Story = {
  render: () => <ControlledBoundaryExample />,
};
