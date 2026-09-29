import { object, type output as ZodOutput, string } from "zod";
import { canonicalBuyerEmailSchema } from "@/lib/lead-pipeline/canonical-buyer-fields";

export const inquiryEmailDataSchema = object({
  referenceId: string().trim().min(1),
  firstName: string(),
  lastName: string(),
  email: canonicalBuyerEmailSchema,
  requirements: string().optional(),
});

export type InquiryEmailData = ZodOutput<typeof inquiryEmailDataSchema>;
