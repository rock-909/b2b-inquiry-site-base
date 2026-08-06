import { describe, expect, it } from "vitest";

import { HTTP_BAD_REQUEST } from "@/constants";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

import { createApiErrorResponse } from "../api-response";

describe("createApiErrorResponse", () => {
  it("keeps the existing public error shape when details are absent", async () => {
    const response = createApiErrorResponse(
      API_ERROR_CODES.INVALID_REQUEST,
      HTTP_BAD_REQUEST,
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INVALID_REQUEST,
    });
  });

  it("includes safe validation details when details are supplied", async () => {
    const response = createApiErrorResponse(
      API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
      HTTP_BAD_REQUEST,
      { details: ["errors.email.invalid"] },
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
      details: ["errors.email.invalid"],
    });
  });

  it("omits empty validation details", async () => {
    const response = createApiErrorResponse(
      API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
      HTTP_BAD_REQUEST,
      { details: [] },
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
    });
  });
});
