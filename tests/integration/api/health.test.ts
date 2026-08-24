import { describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/health/route";

async function expectMinimalHealthResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("x-request-id")).toBeNull();
  expect(response.headers.get("x-observability-surface")).toBeNull();
  await expect(response.json()).resolves.toEqual({ status: "ok" });
}

describe("api/health", () => {
  it("returns a minimal no-store health response", async () => {
    const res = await route.GET(new Request("http://localhost/api/health"));

    await expectMinimalHealthResponse(res);
  });
});

describe("api/health?scope=inquiry readiness", () => {
  const latchState = vi.hoisted(() => ({
    configured: true,
    recentFailure: false as boolean | null,
  }));

  vi.mock("@/lib/observability/inquiry-failure-latch", () => ({
    isInquiryObservabilityConfigured: () => latchState.configured,
    hasRecentInquiryFailure: () => Promise.resolve(latchState.recentFailure),
  }));

  async function getScoped(): Promise<Response> {
    return route.GET(
      new Request("http://localhost/api/health?scope=inquiry"),
    );
  }

  it("returns ok when configured and no recent failure", async () => {
    const res = await getScoped();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns degraded while a recent incident latch exists", async () => {
    latchState.recentFailure = true;

    const res = await getScoped();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "degraded" });
  });

  it("returns degraded when the latch cannot be assessed (unreadable)", async () => {
    latchState.recentFailure = null;

    const res = await getScoped();
    expect(res.status).toBe(503);
  });

  it("returns degraded when observability is not configured", async () => {
    latchState.configured = false;

    const res = await getScoped();
    expect(res.status).toBe(503);
  });
});
