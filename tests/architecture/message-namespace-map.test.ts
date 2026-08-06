import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_MESSAGE_PACK_IDS } from "@/lib/i18n/message-pack-config";

describe("catalog message namespace graph", () => {
  it("keeps only the physical packs used by the catalog runtime", () => {
    expect(CATALOG_MESSAGE_PACK_IDS).toEqual(["base", "b2b-lead", "catalog"]);
    expect(existsSync("messages/profiles/minimal")).toBe(false);
  });

  it("keeps required catalog ownership packs available", () => {
    for (const packRoot of [
      "messages/base/en",
      "messages/profiles/b2b-lead/en",
      "messages/profiles/catalog/en",
    ]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from the fixed catalog pack allowlist above
      expect(existsSync(`${packRoot}/messages.json`), packRoot).toBe(true);
    }
  });
});
