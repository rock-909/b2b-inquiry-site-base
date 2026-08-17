import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

// 只保护当前意图：React Doctor 的 error 和 warning 都必须阻断。
// 版本策略：允许 @latest 或显式语义化版本。固定版本保证 CI 可复现；
// @latest 会在上游回归（如 0.9.12 的 oxlint 插件栈溢出）时拉入破坏性版本。
describe("React Doctor gate contract", () => {
  it("keeps React Doctor blocking on warnings instead of only reporting", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const doctorScript = packageJson.scripts["react:doctor"] ?? "";

    const versionSpec = /react-doctor@([^\s]+)/.exec(doctorScript)?.[1];
    expect(versionSpec).toMatch(/^(latest|\d+\.\d+\.\d+)$/);
    expect(doctorScript).toContain("--blocking warning");
    expect(doctorScript).not.toContain("--blocking none");
  });
});
