import { describe, expect, it } from "vitest";
import { hasOwn } from "@/lib/security/object-guards";

describe("hasOwn", () => {
  it("returns true for own string properties", () => {
    const obj = { name: "test", value: 123 };

    expect(hasOwn(obj, "name")).toBe(true);
    expect(hasOwn(obj, "value")).toBe(true);
  });

  it("returns false for missing properties", () => {
    const obj = { name: "test" };

    expect(hasOwn(obj, "missing")).toBe(false);
  });

  it("does not treat inherited properties as own properties", () => {
    const parent = { inherited: "value" };
    const child = Object.create(parent) as { own: string };
    child.own = "own value";

    expect(hasOwn(child, "own")).toBe(true);
    expect(hasOwn(child, "inherited")).toBe(false);
  });

  it("supports symbol keys", () => {
    const symbolKey = Symbol("test");
    const obj = { [symbolKey]: "symbol value" };

    expect(hasOwn(obj, symbolKey)).toBe(true);
  });
});
