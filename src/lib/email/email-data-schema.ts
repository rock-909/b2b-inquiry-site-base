import { z } from "zod";

export const inquiryEmailDataSchema = z.object({
  referenceId: z.string().trim().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  interest: z.string().optional(),
  offeringId: z.string().optional(),
  offeringName: z.string().optional(),
  requirements: z.string().optional(),
});

export type InquiryEmailData = z.infer<typeof inquiryEmailDataSchema>;
