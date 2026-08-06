import { describe, expect, it } from "vitest";
import {
  hasTurnstileServiceFailure,
  isTurnstileServiceFailureCode,
} from "@/lib/security/turnstile-errors";

describe("turnstile service-failure classification", () => {
  it.each(["not-configured", "network-error", "timeout", "internal-error"])(
    "treats %s as a Turnstile service failure",
    (code) => {
      expect(isTurnstileServiceFailureCode(code)).toBe(true);
    },
  );

  it.each(["invalid-input-response", "invalid-action", "invalid-hostname"])(
    "keeps %s as a security verification failure",
    (code) => {
      expect(isTurnstileServiceFailureCode(code)).toBe(false);
    },
  );

  it("detects service failures inside mixed error-code lists", () => {
    expect(
      hasTurnstileServiceFailure(["invalid-input-response", "timeout"]),
    ).toBe(true);
  });

  it("does not treat empty or ordinary failure lists as service failures", () => {
    expect(hasTurnstileServiceFailure([])).toBe(false);
    expect(hasTurnstileServiceFailure(["invalid-input-response"])).toBe(false);
  });
});
