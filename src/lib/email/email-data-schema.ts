import { z } from "zod";

export const productInquiryEmailDataSchema = z.object({
  referenceId: z.string().trim().min(1),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  productName: z.string(),
  requirements: z.string().optional(),
});

export type ProductInquiryEmailData = z.infer<
  typeof productInquiryEmailDataSchema
>;
