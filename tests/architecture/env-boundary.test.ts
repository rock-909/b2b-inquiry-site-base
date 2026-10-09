import { describe, expect, it } from "vitest";
import {
  getPublicRuntimeEnvString,
  type PublicRuntimeEnvKey,
} from "@/lib/public-runtime-env";

describe("public env runtime boundary", () => {
  it.each([
    "RESEND_API_KEY",
    "AIRTABLE_API_KEY",
    "TURNSTILE_SECRET_KEY",
    "RATE_LIMIT_PEPPER",
    "UPSTASH_REDIS_REST_TOKEN",
    "NEXT_PUBLIC_CSP_NONCE",
  ])("rejects %s at the public runtime boundary", (key) => {
    expect(() => getPublicRuntimeEnvString(key as PublicRuntimeEnvKey)).toThrow(
      "not on the public runtime allowlist",
    );
  });
});
