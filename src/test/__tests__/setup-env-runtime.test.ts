import { describe, expect, it } from "vitest";
import { isRuntimeCloudflare } from "@/lib/env";

describe("shared Vitest runtime setup", () => {
  it("does not force ordinary unit tests into Cloudflare runtime", () => {
    expect(isRuntimeCloudflare()).toBe(false);
  });
});
