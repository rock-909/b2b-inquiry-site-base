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

    it("rejects malformed or unknown values", () => {
      expect(getIPVersion("999.0.0.1")).toBe(0);
      expect(getIPVersion("2001:::1")).toBe(0);
      expect(getIPVersion(":2001:db8::1")).toBe(0);
      expect(getIPVersion("2001:db8::1:")).toBe(0);
      expect(getIPVersion("192.0.2.1::1")).toBe(0);
      expect(getIPVersion("1.2.3.4::")).toBe(0);
      expect(getIPVersion("001.002.003.004")).toBe(0);
      expect(getIPVersion("01.2.3.4")).toBe(0);
      expect(getIPVersion("1.2.3.04")).toBe(0);
      expect(isValidIP("unknown")).toBe(false);
      expect(isValidIP("")).toBe(false);
      expect(isValidIP("   ")).toBe(false);
    });
  });
});
