import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { decodeInquirySubmitState } from "@/components/forms/inquiry-response";

describe("decodeInquirySubmitState", () => {
  it("returns success with the reference id for an ok success body", async () => {
    const response = new Response(
      JSON.stringify({
        success: true,
        data: { referenceId: "inq-ref-100" },
      }),
      { status: 200 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "success",
      referenceId: "inq-ref-100",
    });
  });

  it("classifies validation failures as field errors with details", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.fullName.required"],
      }),
      { status: 400 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "field",
      fieldDetails: ["errors.fullName.required"],
    });
  });

  it("classifies Turnstile failures as security errors", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.TURNSTILE_REJECTED,
      }),
      { status: 400 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "security",
    });
  });

  it("classifies processing failures as server errors", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
      }),
      { status: 500 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "server",
    });
  });

  it("classifies non-JSON responses as server errors", async () => {
    const response = new Response("<html>502</html>", { status: 502 });

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "server",
    });
  });
});
