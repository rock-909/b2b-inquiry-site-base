import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("actual pre-push hook", () => {
  it("rejects main even with no changed files and accepts a feature ref", () => {
    for (const [remote, branch] of [
      ["origin", "main"],
      ["origin", "feature"],
      ["upstream", "main"],
    ]) {
      const result = spawnSync("sh", [".githooks/pre-push", remote!], {
        input: `refs/heads/topic ${"a".repeat(40)} refs/heads/${branch} ${"a".repeat(40)}\n`,
        encoding: "utf8",
        timeout: 5000,
      });
      expect(result.status).toBe(
        remote === "origin" && branch === "main" ? 1 : 0,
      );
    }
  });
});
