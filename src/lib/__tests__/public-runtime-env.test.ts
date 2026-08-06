import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicRuntimeEnvBoolean,
  getPublicRuntimeEnvString,
  isPublicRuntimeDevelopment,
  isPublicRuntimeProduction,
  type PublicRuntimeEnvKey,
} from "../public-runtime-env";

const MODULE_PATH = join(process.cwd(), "src/lib/public-runtime-env.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public-runtime-env", () => {
  it("reads allowlisted NEXT_PUBLIC_* keys via explicit readers", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");

    expect(getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID")).toBe(
      "G-TEST123",
    );
  });

  it("reads legacy-compatible public keys such as NEXT_PUBLIC_BASE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");

    expect(getPublicRuntimeEnvString("NEXT_PUBLIC_BASE_URL")).toBe(
      "https://example.test",
    );
  });

  it("reads legacy-compatible public keys such as NEXT_PUBLIC_APP_NAME", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Tucsenberg");

    expect(getPublicRuntimeEnvString("NEXT_PUBLIC_APP_NAME")).toBe(
      "Tucsenberg",
    );
  });

  it("reads the public deployment environment injected by Next config", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");

    expect(getPublicRuntimeEnvString("NEXT_PUBLIC_APP_ENV")).toBe("preview");
  });

  it("rejects non-allowlisted public keys at runtime", () => {
    expect(() =>
      getPublicRuntimeEnvString(
        "NEXT_PUBLIC_NOT_ALLOWLISTED_EXPERIMENT" as PublicRuntimeEnvKey,
      ),
    ).toThrow(/allowlist/i);
  });

  it("parses boolean env values from common true/false strings", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_BYPASS", "true");
    expect(getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TURNSTILE_BYPASS")).toBe(
      true,
    );

    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_BYPASS", "false");
    expect(getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TURNSTILE_BYPASS")).toBe(
      false,
    );

    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_BYPASS", "1");
    expect(getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TURNSTILE_BYPASS")).toBe(
      false,
    );
  });

  it("derives NODE_ENV helpers from public runtime reads", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isPublicRuntimeProduction()).toBe(true);
    expect(isPublicRuntimeDevelopment()).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    expect(isPublicRuntimeProduction()).toBe(false);
    expect(isPublicRuntimeDevelopment()).toBe(true);
  });

  it("does not expose forbidden server env keys in module source", () => {
    const source = readFileSync(MODULE_PATH, "utf8");

    expect(source).not.toMatch(/from ["']zod["']/);
    expect(source).not.toMatch(/@t3-oss\/env-nextjs/);
    expect(source).not.toContain("createEnv");
    expect(source).not.toContain("RESEND_API_KEY");
    expect(source).not.toContain("TURNSTILE_SECRET_KEY");
    expect(source).not.toContain("requireEnvVar");
  });
});
