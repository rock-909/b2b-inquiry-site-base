import { describe, expect, it } from "vitest";
import {
  getIPVersion,
  isValidIP,
  parseFirstIP,
  stripPort,
} from "../ip-parsing";

describe("ip-parsing", () => {
  describe("stripPort", () => {
    it("strips ports from IPv4 and bracketed IPv6 literals", () => {
      expect(stripPort("203.0.113.5:443")).toBe("203.0.113.5");
      expect(stripPort("[2001:db8::1]:8443")).toBe("2001:db8::1");
      expect(stripPort("[2001:db8::1]")).toBe("2001:db8::1");
    });

    it("keeps plain IPv6 literals and malformed bracket forms unchanged", () => {
      expect(stripPort("2001:db8::1")).toBe("2001:db8::1");
      expect(stripPort("[2001:db8::1")).toBe("[2001:db8::1");
      expect(stripPort("[]:443")).toBe("[]:443");
      expect(stripPort("203.0.113.5]:443")).toBe("203.0.113.5]");
      expect(stripPort("[2001:db8::1]:443/extra")).toBe(
        "[2001:db8::1]:443/extra",
      );
      expect(stripPort("[2001:db8::1]:")).toBe("[2001:db8::1]:");
      expect(stripPort("[2001:db8::1]:a")).toBe("[2001:db8::1]:a");
      expect(stripPort("[2001:db8::1]:/")).toBe("[2001:db8::1]:/");
      expect(stripPort("[2001:db8::1]443")).toBe("[2001:db8::1]443");
      expect(stripPort("x[2001:db8::1]:443")).toBe("x[2001:db8::1]:443");
    });

    it("only strips single-colon host:port forms", () => {
      expect(stripPort("example.com:443")).toBe("example.com");
      expect(stripPort("[2001:db8::1]:9")).toBe("2001:db8::1");
      expect(stripPort("2001:db8::1:443")).toBe("2001:db8::1:443");
    });
  });

  describe("parseFirstIP", () => {
    it("trims a single forwarded IP when no comma is present", () => {
      expect(parseFirstIP(" 203.0.113.99 ")).toBe("203.0.113.99");
      expect(parseFirstIP(" 203.0.113.5:443 ")).toBe("203.0.113.5");
    });

    it("returns the first trimmed IP from forwarding headers", () => {
      expect(parseFirstIP(" 203.0.113.5:443 , 198.51.100.10")).toBe(
        "203.0.113.5",
      );
      expect(parseFirstIP(" 203.0.113.5 , 198.51.100.10")).toBe("203.0.113.5");
      expect(parseFirstIP(", 198.51.100.10")).toBe("");
      expect(parseFirstIP("")).toBe("");
      expect(parseFirstIP("203.0.113.99")).toBe("203.0.113.99");
    });
  });

  describe("ip validation", () => {
    it("recognizes valid IPv4 and IPv6 addresses", () => {
      expect(getIPVersion("203.0.113.5")).toBe(4);
      expect(getIPVersion("2001:db8::1")).toBe(6);
      expect(isValidIP("::ffff:192.0.2.128")).toBe(true);
      expect(isValidIP(" 203.0.113.5 ")).toBe(true);
    });

    // 畸形地址的解析拒绝由 ip-range.test.ts 负责，这里只守 isValidIP 的入口。
    it("rejects unknown or blank values", () => {
      expect(isValidIP("unknown")).toBe(false);
      expect(isValidIP("")).toBe(false);
      expect(isValidIP("   ")).toBe(false);
    });
  });
});
