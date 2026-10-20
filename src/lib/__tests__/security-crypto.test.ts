import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateHMAC } from "@/lib/security/crypto";

describe("security-crypto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateHMAC", () => {
    it("should generate HMAC with SHA-256 by default", async () => {
      // RFC 4231 test case 2：只有真正的 HMAC-SHA256 才得到这个值。
      const hmac = await generateHMAC("what do ya want for nothing?", "Jefe");

      expect(hmac).toBe(
        "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
      );
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
