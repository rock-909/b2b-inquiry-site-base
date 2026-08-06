import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LazyTurnstile } from "@/components/forms/lazy-turnstile";
import { createTestTurnstileLabels } from "@/test/inquiry-test-messages";

const storyTokenHandler = () => undefined;
const storyStatusHandler = () => undefined;
const storyTurnstileLabels = createTestTurnstileLabels();

const meta = {
  title: "Forms/LazyTurnstile",
  component: LazyTurnstile,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSuccess: storyTokenHandler,
    onError: storyStatusHandler,
    onExpire: storyStatusHandler,
    labels: storyTurnstileLabels,
  },
} satisfies Meta<typeof LazyTurnstile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const StorybookFallback: Story = {
  render: () => (
    <div className="w-[320px] rounded-md border border-border p-4">
      <LazyTurnstile
        onSuccess={storyTokenHandler}
        onError={storyStatusHandler}
        onExpire={storyStatusHandler}
        labels={storyTurnstileLabels}
      />
      <p className="mt-3 text-sm text-muted-foreground">
        If a site key is not configured, or the widget stays silent for 15
        seconds, this wrapper renders the single rescue prompt with an email
        fallback.
      </p>
    </div>
  ),
};
