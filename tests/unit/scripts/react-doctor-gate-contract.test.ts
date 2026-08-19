import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

// 保护当前意图：跟随 React Doctor 最新版，error 和 warning 都必须阻断。
describe("React Doctor gate contract", () => {
  it("keeps React Doctor blocking on warnings instead of only reporting", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const doctorScript = packageJson.scripts["react:doctor"] ?? "";

    const versionSpec = /react-doctor@([^\s]+)/.exec(doctorScript)?.[1];
    expect(versionSpec).toBe("latest");
    expect(doctorScript).toContain("--blocking warning");
    expect(doctorScript).not.toContain("--blocking none");
  });
});
