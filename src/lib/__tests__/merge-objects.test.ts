import { describe, expect, it } from "vitest";
import { mergeObjects } from "@/lib/merge-objects";

describe("mergeObjects", () => {
  it("merges defined source values and preserves target when source is undefined", () => {
    interface Model extends Record<string, unknown> {
      a: number;
      b: string | undefined;
    }

    const target: Model = { a: 1, b: "x" };
    const source: Partial<Model> = { a: 2, b: undefined };

    const merged = mergeObjects(target, source);

    expect(merged).toEqual({ a: 2, b: "x" });
    expect(target).toEqual({ a: 1, b: "x" });
  });

  it("deep merges nested plain objects and keeps target-only keys", () => {
    interface Model extends Record<string, unknown> {
      nested: Record<string, number>;
    }

    const target: Model = { nested: { keep: 1, change: 1 } };
    const source: Partial<Model> = { nested: { change: 2 } };

    const merged = mergeObjects(target, source);

    expect(merged).toEqual({ nested: { keep: 1, change: 2 } });
  });

  it("replaces arrays instead of deep merging them", () => {
    interface Model extends Record<string, unknown> {
      items: number[];
    }

    const target: Model = { items: [1, 2] };
    const source: Partial<Model> = { items: [3] };

    const merged = mergeObjects(target, source);

    expect(merged).toEqual({ items: [3] });
  });

  it("ignores inherited enumerable properties on source", () => {
    const source = Object.create({ inherited: "nope" }) as Partial<
      Record<string, unknown>
    >;
    source.own = "ok";

    const merged = mergeObjects<Record<string, unknown>>({}, source);

    expect(merged).toEqual({ own: "ok" });
  });

  it("drops prototype-pollution keys from source", () => {
    const source = Object.create(null) as Record<string, unknown>;

    Object.defineProperty(source, "__proto__", {
      value: { polluted: true },
      enumerable: true,
    });
    Object.defineProperty(source, "constructor", {
      value: { polluted: true },
      enumerable: true,
    });
    Object.defineProperty(source, "prototype", {
      value: { polluted: true },
      enumerable: true,
    });
    source.safe = "ok";

    const merged = mergeObjects<Record<string, unknown>>({}, source);

    expect(merged).toEqual({ safe: "ok" });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(merged, "__proto__")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(merged, "constructor")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(merged, "prototype")).toBe(
      false,
    );
  });
});
