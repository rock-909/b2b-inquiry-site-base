/**
 * Shared request/mock harness for /api/inquiry route behavior lanes.
 *
 * 每个 lane 测试文件通过这里的同一组 mock 实例驱动路由，避免各自复制一套
 * mock universe；lane 之间唯一的差别是需要覆写的 Once 行为。
 *
 * 注意：CORS 工具（cors-utils / origin-policy）不再被 mock——route 合同
 * 直接走真实实现，防止测试悄悄重写出第二套 CORS 语义。
 */

import { NextRequest } from "next/server";
import { vi } from "vitest";

export const routeMocks = {
  getIPKey: vi.fn(async () => "ip:test-key"),
  checkInquiryRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60_000,
    retryAfter: null,
  })),
  processValidatedInquiry: vi.fn(async () => ({
    success: true,
    emailSent: true,
    recordCreated: true,
    referenceId: "ref-123",
  })),
  verifyTurnstileDetailed: vi.fn(async () => ({ success: true })),
};

export function createInquiryRequest(
  body: BodyInit | null,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost:3000/api/inquiry", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export const validInquiryData = {
  turnstileToken: "valid-token",
  type: "browser-spoof",
  fullName: "John Doe",
  email: "john@example.com",
  message: "I am interested in your products.",
};

export const generalInquiryData = {
  turnstileToken: "valid-token",
  fullName: "Rita Buyer",
  email: "rita@example.com",
  message: "Submitted via the contact form.",
};
