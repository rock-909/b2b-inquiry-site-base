import { describe, expect, it } from "vitest";
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
    const res = route.GET();

    await expectMinimalHealthResponse(res);
  });
});
