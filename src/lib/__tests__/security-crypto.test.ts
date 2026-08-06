import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateHMAC } from "@/lib/security/crypto";

describe("security-crypto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateHMAC", () => {
    it("should generate HMAC with SHA-256 by default", async () => {
      const hmac = await generateHMAC("data", "secret");

      expect(hmac).toBeDefined();
      expect(hmac.length).toBe(64); // SHA-256 HMAC = 64 hex chars
    });

    it("should generate HMAC with SHA-512", async () => {
      const hmac = await generateHMAC("data", "secret", "SHA-512");

      expect(hmac).toBeDefined();
      expect(hmac.length).toBe(128); // SHA-512 HMAC = 128 hex chars
    });

    it("should produce consistent HMAC for same inputs", async () => {
      const hmac1 = await generateHMAC("data", "secret");
      const hmac2 = await generateHMAC("data", "secret");

      expect(hmac1).toBe(hmac2);
    });

    it("should produce different HMAC for different data", async () => {
      const hmac1 = await generateHMAC("data1", "secret");
      const hmac2 = await generateHMAC("data2", "secret");

      expect(hmac1).not.toBe(hmac2);
    });

    it("should produce different HMAC for different secrets", async () => {
      const hmac1 = await generateHMAC("data", "secret1");
      const hmac2 = await generateHMAC("data", "secret2");

      expect(hmac1).not.toBe(hmac2);
    });
  });
});
