import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("legacy security-policy route", () => {
  it("stays a non-cacheable 404 instead of entering stale revalidation", async () => {
    const response = GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });
});
