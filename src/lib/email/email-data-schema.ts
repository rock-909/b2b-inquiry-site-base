import { email, object, type output as ZodOutput, string } from "zod";

export const inquiryEmailDataSchema = object({
  referenceId: string().trim().min(1),
  firstName: string(),
  lastName: string(),
  email: email(),
  interest: string().optional(),
  offeringId: string().optional(),
  offeringName: string().optional(),
  requirements: string().optional(),
});

export type InquiryEmailData = ZodOutput<typeof inquiryEmailDataSchema>;
