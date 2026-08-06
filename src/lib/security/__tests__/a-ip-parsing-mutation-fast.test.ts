import { describe, expect, it } from "vitest";
import { parseFirstIP, stripPort } from "../ip-parsing";

describe("ip-parsing mutation fast path", () => {
  it("trims a single forwarded IP before returning it", () => {
    expect(parseFirstIP(" 203.0.113.99 ")).toBe("203.0.113.99");
  });

  it("splits forwarding headers on commas before normalizing the first IP", () => {
    expect(parseFirstIP("203.0.113.5, 198.51.100.10")).toBe("203.0.113.5");
  });

  it("does not treat a stray closing bracket as an IPv6 host wrapper", () => {
    expect(stripPort("203.0.113.5]:443")).toBe("203.0.113.5]");
  });

  it("only matches whole bracketed IPv6 literals, with or without a numeric port", () => {
    expect(stripPort("[2001:db8::1]")).toBe("2001:db8::1");
    expect(stripPort("[2001:db8::1]:9")).toBe("2001:db8::1");
    expect(stripPort("[2001:db8::1]:")).toBe("[2001:db8::1]:");
    expect(stripPort("[2001:db8::1]443")).toBe("[2001:db8::1]443");
    expect(stripPort("[2001:db8::1]:a")).toBe("[2001:db8::1]:a");
    expect(stripPort("[2001:db8::1]:/")).toBe("[2001:db8::1]:/");
    expect(stripPort("[]:443")).toBe("[]:443");
    expect(stripPort("[2001:db8::1]:443/extra")).toBe(
      "[2001:db8::1]:443/extra",
    );
    expect(stripPort("x[2001:db8::1]:443")).toBe("x[2001:db8::1]:443");
  });
});
