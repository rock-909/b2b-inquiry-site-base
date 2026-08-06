import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { mergeObjects as runtimeMerge } from "@/lib/merge-objects";

// content:check composes the message packs itself to validate the graph the site
// will actually ship. It is a plain node script and cannot require the runtime
// TypeScript module, so it carries its own copy. When the two drift, the check
// validates a merge result that never reaches production — this test is what
// makes that drift fail instead of passing quietly.
const require = createRequire(import.meta.url);
const { mergeObjects: scriptMerge } =
  require("../../../scripts/quality/checks/translations.js") as {
    mergeObjects: (
      target: Record<string, unknown>,
      source: Record<string, unknown>,
    ) => Record<string, unknown>;
  };

const CASES: ReadonlyArray<{
  name: string;
  target: Record<string, unknown>;
  source: Record<string, unknown>;
}> = [
  {
    name: "source wins on a flat key",
    target: { a: "base", b: "keep" },
    source: { a: "override" },
  },
  {
    name: "nested plain objects merge recursively",
    target: { nav: { home: "Home", about: "About" } },
    source: { nav: { about: "Company" } },
  },
  {
    name: "undefined source values leave the target value in place",
    target: { a: "base" },
    source: { a: undefined },
  },
  {
    name: "arrays replace instead of merging",
    target: { items: ["a", "b"] },
    source: { items: ["c"] },
  },
  {
    name: "null replaces an object branch",
    target: { block: { a: "1" } },
    source: { block: null },
  },
  {
    name: "a deeper branch only present in source is added",
    target: {},
    source: { form: { field: { label: "Email" } } },
  },
  // JSON.parse turns these into real own properties, so a message pack can carry
  // them and the two implementations must agree on dropping them.
  {
    name: "__proto__ from parsed JSON is dropped",
    target: { a: "base" },
    source: JSON.parse('{"__proto__": {"polluted": true}, "a": "override"}'),
  },
  {
    name: "constructor from parsed JSON is dropped",
    target: { a: "base" },
    source: JSON.parse('{"constructor": {"polluted": true}}'),
  },
  {
    name: "prototype from parsed JSON is dropped",
    target: { a: "base" },
    source: JSON.parse('{"prototype": {"polluted": true}}'),
  },
];

describe("message merge parity between runtime and content:check", () => {
  it.each(CASES)("agrees on: $name", ({ target, source }) => {
    expect(scriptMerge(target, source)).toStrictEqual(
      runtimeMerge(target, source),
    );
  });

  // toStrictEqual only compares own properties, so a `__proto__` key that lands
  // on the prototype instead of the object is invisible to the cases above.
  // Assert the prototype directly or this guard proves nothing.
  it.each([
    { name: "content:check copy", merge: scriptMerge },
    { name: "runtime", merge: runtimeMerge },
  ])("keeps a clean prototype on the merge result: $name", ({ merge }) => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}}') as Record<
      string,
      unknown
    >;

    const merged = merge({}, hostile);

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(merged).toStrictEqual({});
  });
});
