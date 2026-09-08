/**
 * Shared request/mock harness for /api/inquiry route behavior lanes.
 *
 * 每个 lane 测试文件通过这里的同一组 mock 实例驱动路由，避免各自复制一套
 * mock universe；lane 之间唯一的差别是需要覆写的 Once 行为。
 *
 * 注意：Origin 检查不再被 mock——route 合同
 * 直接走真实实现，防止测试悄悄重写出第二套准入语义。
 */

import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
import type { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import type { verifyTurnstileDetailed } from "@/lib/security/turnstile";
import type { getIPKey } from "@/lib/security/rate-limit-key-strategies";

export const routeMocks = {
  getIPKey: vi.fn<typeof getIPKey>(async () => "ip:test-key"),
  checkInquiryRateLimit: vi.fn<typeof checkInquiryRateLimit>(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60_000,
    retryAfter: null,
  })),
  processValidatedInquiry: vi.fn<typeof processValidatedInquiry>(async () => ({
    success: true,
    emailSent: true,
    recordCreated: true,
    referenceId: "ref-123",
  })),
  verifyTurnstileDetailed: vi.fn<typeof verifyTurnstileDetailed>(async () => ({
    success: true,
  })),
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
