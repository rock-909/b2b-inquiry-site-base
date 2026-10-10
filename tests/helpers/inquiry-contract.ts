import { z } from "zod";

const errorBody = <T extends string>(code: T) =>
  z.strictObject({
    success: z.literal(false),
    errorCode: z.literal(code),
  });

// 测试端同时校验浏览器桩与真实 route 响应，不进入客户端依赖图。
export const inquiryResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal(200),
    body: z.strictObject({
      success: z.literal(true),
      data: z.strictObject({ referenceId: z.string().min(1) }),
    }),
  }),
  z.strictObject({
    status: z.literal(400),
    body: z.union([
      errorBody("TURNSTILE_REQUIRED"),
      errorBody("TURNSTILE_REJECTED"),
      errorBody("INVALID_JSON_BODY"),
      z.strictObject({
        success: z.literal(false),
        errorCode: z.literal("INQUIRY_VALIDATION_FAILED"),
        details: z.array(z.string()).optional(),
      }),
    ]),
  }),
  z.strictObject({
    status: z.literal(403),
    body: errorBody("INVALID_REQUEST"),
  }),
  z.strictObject({
    status: z.literal(413),
    body: errorBody("PAYLOAD_TOO_LARGE"),
  }),
  z.strictObject({
    status: z.literal(415),
    body: errorBody("UNSUPPORTED_MEDIA_TYPE"),
  }),
  z.strictObject({
    status: z.literal(429),
    body: errorBody("RATE_LIMIT_EXCEEDED"),
    headers: z.strictObject({ "Retry-After": z.string().regex(/^\d+$/) }),
  }),
  z.strictObject({
    status: z.literal(500),
    body: errorBody("INQUIRY_PROCESSING_ERROR"),
  }),
  z.strictObject({
    status: z.literal(503),
    body: errorBody("TURNSTILE_UNAVAILABLE"),
  }),
]);

export function checkedInquiryStub(
  candidate: z.input<typeof inquiryResponseSchema>,
) {
  const parsed = inquiryResponseSchema.parse(candidate);
  return {
    status: parsed.status,
    headers: "headers" in parsed ? parsed.headers : {},
    contentType: "application/json",
    body: JSON.stringify(parsed.body),
  };
}

export async function assertInquiryResponseContract(response: Response) {
  inquiryResponseSchema.parse({
    status: response.status,
    body: await response.clone().json(),
    ...(response.status === 429
      ? { headers: { "Retry-After": response.headers.get("Retry-After") } }
      : {}),
  });
}
