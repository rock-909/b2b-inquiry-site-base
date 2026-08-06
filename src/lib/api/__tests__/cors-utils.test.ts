import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCorsHeaders,
  createCorsPreflightResponse,
  getCorsHeaders,
} from "../cors-utils";

// Use vi.hoisted for mock functions to ensure proper initialization
const mockIsAllowedOrigin = vi.hoisted(() => vi.fn());
const mockIsSameOrigin = vi.hoisted(() => vi.fn());

vi.mock("@/config/cors", () => ({
  isAllowedOrigin: mockIsAllowedOrigin,
  isSameOrigin: mockIsSameOrigin,
  CORS_CONFIG: {
    allowedMethods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 3600,
  },
}));

describe("CORS Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSameOrigin.mockReturnValue(false);
    mockIsAllowedOrigin.mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function createMockRequest(
    origin: string | null,
    host = "example.com",
  ): NextRequest {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    headers.set("host", host);

    return new NextRequest("http://example.com/api/test", {
      method: "OPTIONS",
      headers,
    });
  }

  describe("getCorsHeaders", () => {
    it("should return empty object for disallowed origin", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(false);

      const request = createMockRequest("https://evil.com");
      const headers = getCorsHeaders(request);

      expect(headers).toEqual({});
    });

    it("should return headers for same-origin request", () => {
      mockIsSameOrigin.mockReturnValue(true);
      mockIsAllowedOrigin.mockReturnValue(false);

      const request = createMockRequest(null);
      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
      expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
      expect(headers["Access-Control-Max-Age"]).toBe("3600");
    });

    it("should return headers with origin for allowed cross-origin request", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(true);

      const request = createMockRequest("https://allowed.com");
      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://allowed.com",
      );
      expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    });

    it("should include additional methods", () => {
      mockIsSameOrigin.mockReturnValue(true);

      const request = createMockRequest(null);
      const headers = getCorsHeaders(request, {
        additionalMethods: ["GET", "DELETE"],
      });

      expect(headers["Access-Control-Allow-Methods"]).toBe(
        "POST, OPTIONS, GET, DELETE",
      );
    });

    it("should include additional headers", () => {
      mockIsSameOrigin.mockReturnValue(true);

      const request = createMockRequest(null);
      const headers = getCorsHeaders(request, {
        additionalHeaders: ["Authorization", "X-Custom"],
      });

      expect(headers["Access-Control-Allow-Headers"]).toBe(
        "Content-Type, Authorization, X-Custom",
      );
    });
  });

  describe("createCorsPreflightResponse", () => {
    it("should return 204 for disallowed origin", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(false);

      const request = createMockRequest("https://evil.com");
      const response = createCorsPreflightResponse(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("should return 200 with headers for allowed origin", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(true);

      const request = createMockRequest("https://allowed.com");
      const response = createCorsPreflightResponse(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://allowed.com",
      );
    });

    it("should return 200 with headers for same-origin request", () => {
      mockIsSameOrigin.mockReturnValue(true);
      mockIsAllowedOrigin.mockReturnValue(false);

      const request = createMockRequest(null);
      const response = createCorsPreflightResponse(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    });

    it("should include additional methods and headers", () => {
      mockIsSameOrigin.mockReturnValue(true);

      const request = createMockRequest(null);
      const response = createCorsPreflightResponse(
        request,
        ["GET"],
        ["Authorization"],
      );

      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization",
      );
    });
  });

  describe("applyCorsHeaders", () => {
    it("should apply CORS headers to response", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(true);

      const request = createMockRequest("https://allowed.com");
      const nextResponse = NextResponse.json(
        { success: true },
        { status: 200 },
      );

      const result = applyCorsHeaders({ response: nextResponse, request });

      expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://allowed.com",
      );
    });

    it("should not modify response for disallowed origin", () => {
      mockIsSameOrigin.mockReturnValue(false);
      mockIsAllowedOrigin.mockReturnValue(false);

      const request = createMockRequest("https://evil.com");
      const nextResponse = NextResponse.json(
        { success: true },
        { status: 200 },
      );

      const result = applyCorsHeaders({ response: nextResponse, request });

      expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });
});
