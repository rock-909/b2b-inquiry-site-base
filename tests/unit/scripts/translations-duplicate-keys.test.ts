import { describe, expect, it } from "vitest";
import {
  findCrossPackLeafConflicts,
  findCrossPackLeafConflictsFromMaps,
  findDuplicateJsonObjectKeys,
  pathsHaveOwnershipConflict,
} from "../../../scripts/quality/checks/translations.js";

describe("translations duplicate object-key scan", () => {
  it("detects sibling duplicate keys that JSON.parse would silently collapse", () => {
    const source = '{"submit":"first","submit":"second"}';

    expect(JSON.parse(source)).toEqual({ submit: "second" });
    expect(findDuplicateJsonObjectKeys(source)).toEqual([
      {
        key: "submit",
        line: 1,
        path: "submit",
      },
    ]);
  });

  it("detects nested sibling duplicates with path and line", () => {
    const source = `{
  "errors": {
    "required": "first",
    "required": "second"
  }
}`;

    expect(findDuplicateJsonObjectKeys(source)).toEqual([
      {
        key: "required",
        line: 4,
        path: "errors.required",
      },
    ]);
  });

  it("accepts unique sibling keys", () => {
    expect(
      findDuplicateJsonObjectKeys('{"submit":"ok","cancel":"ok"}'),
    ).toEqual([]);
  });
});

describe("translations cross-pack leaf ownership", () => {
  it("fails when two packs claim the same leaf path", () => {
    expect(
      findCrossPackLeafConflictsFromMaps([
        { packId: "base", leafPaths: ["shared.value", "only.base"] },
        { packId: "catalog", leafPaths: ["shared.value", "only.catalog"] },
      ]),
    ).toEqual([
      {
        earlierPackId: "base",
        earlierPath: "shared.value",
        laterPackId: "catalog",
        path: "shared.value",
      },
    ]);
  });

  it("fails when a later pack nests under an earlier leaf", () => {
    expect(
      findCrossPackLeafConflictsFromMaps([
        { packId: "base", leafPaths: ["foo"] },
        { packId: "catalog", leafPaths: ["foo.bar"] },
      ]),
    ).toEqual([
      {
        earlierPackId: "base",
        earlierPath: "foo",
        laterPackId: "catalog",
        path: "foo.bar",
      },
    ]);
  });

  it("fails when a later pack replaces an earlier nested branch", () => {
    expect(
      findCrossPackLeafConflictsFromMaps([
        { packId: "base", leafPaths: ["foo.bar"] },
        { packId: "catalog", leafPaths: ["foo"] },
      ]),
    ).toEqual([
      {
        earlierPackId: "base",
        earlierPath: "foo.bar",
        laterPackId: "catalog",
        path: "foo",
      },
    ]);
  });

  it("does not treat shared path prefixes without a segment boundary as conflicts", () => {
    expect(pathsHaveOwnershipConflict("foo", "foobar")).toBe(false);
    expect(
      findCrossPackLeafConflictsFromMaps([
        { packId: "base", leafPaths: ["foo", "nav.label"] },
        { packId: "catalog", leafPaths: ["foobar", "nav.labelExtra"] },
      ]),
    ).toEqual([]);
  });

  it("accepts the live English packs with mutually exclusive ownership", () => {
    expect(findCrossPackLeafConflicts("en")).toEqual([]);
  });
});
