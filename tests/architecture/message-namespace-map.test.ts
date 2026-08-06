import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGE_PACK_IDS } from "@/lib/i18n/message-pack-config";

describe("message namespace graph", () => {
  it("keeps only the physical packs used by the inquiry-site runtime", () => {
    expect(MESSAGE_PACK_IDS).toEqual(["base", "b2b-lead"]);
    expect(existsSync("messages/profiles/catalog")).toBe(false);
  });

  it("keeps required message ownership packs available", () => {
    for (const packRoot of [
      "messages/base/en",
      "messages/profiles/b2b-lead/en",
    ]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from the fixed message-pack allowlist above
      expect(existsSync(`${packRoot}/messages.json`), packRoot).toBe(true);
    }
  });
});
