import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useMessages } from "next-intl";
import {
  InquiryForm,
  type InquiryFormSource,
} from "@/components/forms/inquiry-form";
import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import type { ValidatedInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";

interface InquiryFormStoryProps {
  source: InquiryFormSource;
  context: ValidatedInquiryContext;
}

function InquiryFormStory({ source, context }: InquiryFormStoryProps) {
  const messages = useMessages() as Record<string, unknown>;
  const copy = createInquiryFormCopyFromMessages(messages);
  return (
    <InquiryForm
      source={source}
      copy={copy}
      context={context}
      fallback={<InquiryFormStaticFallback copy={copy} />}
    />
  );
}

const meta = {
  title: "Forms/InquiryForm",
  component: InquiryFormStory,
  tags: ["autodocs"],
} satisfies Meta<typeof InquiryFormStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GeneralContact: Story = {
  args: { source: "contact", context: { kind: "general-context" } },
};

export const CatalogContext: Story = {
  args: {
    source: "request-quote",
    context: {
      kind: "catalog-context",
      catalogProductId: "abs-flood-barriers",
      displayLabel: "ABS Flood Barriers",
    },
  },
};
