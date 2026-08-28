import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts/git/pre-push-guard.js");

function runGuard(remoteName: string, input: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, remoteName], {
    cwd: REPO_ROOT,
    input,
    encoding: "utf8",
  });
}

describe("pre-push main branch guard", () => {
  it("blocks pushes to origin/main", () => {
    const result = runGuard(
      "origin",
      "refs/heads/topic 1111111111111111111111111111111111111111 refs/heads/main 2222222222222222222222222222222222222222\n",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Direct push to origin/main is blocked");
  });

  it("allows feature branches and non-origin remotes", () => {
    const feature = runGuard(
      "origin",
      "refs/heads/topic 1111111111111111111111111111111111111111 refs/heads/topic 2222222222222222222222222222222222222222\n",
    );
    const otherRemote = runGuard(
      "upstream",
      "refs/heads/topic 1111111111111111111111111111111111111111 refs/heads/main 2222222222222222222222222222222222222222\n",
    );

    expect(feature.status).toBe(0);
    expect(otherRemote.status).toBe(0);
  });
});
