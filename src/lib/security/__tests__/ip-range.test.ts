import { describe, expect, it } from "vitest";
import {
  integerToIpv4,
  ipv4MappedEmbeddedAddress,
  ipv4ToInteger,
  ipv6NetworkPrefix64,
  ipv6ToBigInt,
} from "../ip-range";

describe("ip-range", () => {
  describe("ipv4 parsing", () => {
    it("converts valid IPv4 addresses", () => {
      expect(ipv4ToInteger("192.168.0.1")).toBe(3232235521);
      expect(ipv4ToInteger("255.255.255.255")).toBe(4294967295);
    });

    it("rejects malformed IPv4 addresses", () => {
      expect(ipv4ToInteger("192.168.0")).toBeNull();
      expect(ipv4ToInteger("192.168.0.256")).toBeNull();
      expect(ipv4ToInteger("192.168.-1.1")).toBeNull();
      expect(ipv4ToInteger("192.168.one.1")).toBeNull();
      expect(ipv4ToInteger("001.002.003.004")).toBeNull();
      expect(ipv4ToInteger("01.2.3.4")).toBeNull();
      expect(ipv4ToInteger("1.2.3.04")).toBeNull();
    });
  });

  describe("ipv6 parsing", () => {
    it("parses compressed IPv6 and IPv4-mapped IPv6", () => {
      expect(ipv6ToBigInt("::")).toBe(0n);
      expect(ipv6ToBigInt("2001:db8::")).toBe(
        42540766411282592856903984951653826560n,
      );
      expect(ipv6ToBigInt("2001:db8::1")).toBe(
        42540766411282592856903984951653826561n,
      );
      expect(ipv6ToBigInt("2001:0db8:0000:0000:0000:ff00:0042:8329")).toBe(
        42540766411282592856904265327123268393n,
      );
      expect(ipv6ToBigInt("::ffff:192.0.2.128")).toBe(281473902969472n);
    });

    it("rejects malformed IPv6 addresses", () => {
      expect(ipv6ToBigInt("2001:::1")).toBeNull();
      expect(ipv6ToBigInt(":2001:db8::1")).toBeNull();
      expect(ipv6ToBigInt("2001:db8::1:")).toBeNull();
      expect(ipv6ToBigInt("2001:db8::zzzz")).toBeNull();
      expect(ipv6ToBigInt("1/2:2:3:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("1@:2:3:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("1g:2:3:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("g1:2:3:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("00001:2:3:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("2001:db8::1::5")).toBeNull();
      expect(ipv6ToBigInt("1::2::3")).toBeNull();
      expect(ipv6ToBigInt("1:2:3:4:5:6:7:8::")).toBeNull();
      expect(ipv6ToBigInt("1:2:3:4:5:6:7:8:9")).toBeNull();
      expect(ipv6ToBigInt("1:2:3:4:5:6:7:10000")).toBeNull();
      expect(ipv6ToBigInt("1:2:10000:4:5:6:7:8")).toBeNull();
      expect(ipv6ToBigInt("::ffff:999.0.2.128")).toBeNull();
      expect(ipv6ToBigInt("999.0.2.128::1")).toBeNull();
      expect(ipv6ToBigInt("192.0.2.1::1")).toBeNull();
      expect(ipv6ToBigInt("1.2.3.4::")).toBeNull();
    });
  });

  describe("ipv4-mapped detection", () => {
    it("detects embedded IPv4 in mapped addresses", () => {
      expect(ipv4MappedEmbeddedAddress("::ffff:192.0.2.128")).toBe(
        ipv4ToInteger("192.0.2.128"),
      );
      expect(ipv4MappedEmbeddedAddress("0:0:0:0:0:ffff:192.0.2.128")).toBe(
        ipv4ToInteger("192.0.2.128"),
      );
      expect(ipv4MappedEmbeddedAddress("::ffff:192.0.2.129")).toBe(
        ipv4ToInteger("192.0.2.129"),
      );
    });

    it("does not treat native IPv4 or ordinary IPv6 as mapped", () => {
      expect(ipv4MappedEmbeddedAddress("192.0.2.128")).toBeNull();
      expect(ipv4MappedEmbeddedAddress("2001:db8::1")).toBeNull();
      expect(ipv4MappedEmbeddedAddress("::1")).toBeNull();
      expect(ipv4MappedEmbeddedAddress("fe80::1")).toBeNull();
    });

    it("round-trips mapped embedded IPv4 through integerToIpv4", () => {
      const embedded = ipv4MappedEmbeddedAddress("::ffff:203.0.113.50");
      expect(embedded).toBe(ipv4ToInteger("203.0.113.50"));
      expect(integerToIpv4(embedded!)).toBe("203.0.113.50");
    });

    it("keeps ordinary IPv6 /64 bucketing separate from mapped detection", () => {
      const samePrefixA = ipv6NetworkPrefix64("2001:db8:1234:5678::1");
      const samePrefixB = ipv6NetworkPrefix64(
        "2001:db8:1234:5678:ffff:eeee:dddd:9999",
      );
      const differentPrefix = ipv6NetworkPrefix64("2001:db8:1234:5679::1");

      expect(samePrefixA).toBe(samePrefixB);
      expect(samePrefixA).not.toBe(differentPrefix);
      expect(ipv4MappedEmbeddedAddress("2001:db8:1234:5678::1")).toBeNull();
    });
  });
});
