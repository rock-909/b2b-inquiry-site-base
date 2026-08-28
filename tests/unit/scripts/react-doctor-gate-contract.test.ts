import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const PINNED_REACT_DOCTOR_VERSION = "0.9.12";

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function readPackageJson() {
  return JSON.parse(readRepoFile("package.json")) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
}

// 保护当前意图：required gate 使用仓库锁定的 React Doctor 版本（exact semver，
// 禁止 @latest 动态解析），error 和 warning 都必须阻断；report 保持非阻断。
describe("React Doctor gate contract", () => {
  it("pins an exact react-doctor version in devDependencies", () => {
    const { devDependencies } = readPackageJson();
    const version = devDependencies["react-doctor"];

    expect(version).toBe(PINNED_REACT_DOCTOR_VERSION);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it("runs the pinned local binary via pnpm exec without @latest", () => {
    const packageJson = readPackageJson();
    const doctorScript = packageJson.scripts["react:doctor"] ?? "";
    const reportScript = packageJson.scripts["react:doctor:report"] ?? "";

    expect(doctorScript).toContain("pnpm exec react-doctor");
    expect(reportScript).toContain("pnpm exec react-doctor");
    expect(doctorScript).not.toContain("@latest");
    expect(reportScript).not.toContain("@latest");
  });

  it("keeps React Doctor blocking on warnings instead of only reporting", () => {
    const packageJson = readPackageJson();
    const doctorScript = packageJson.scripts["react:doctor"] ?? "";

    expect(doctorScript).toContain("--blocking warning");
    expect(doctorScript).not.toContain("--blocking none");
  });

  it("keeps the report entrypoint non-blocking with json output", () => {
    const packageJson = readPackageJson();
    const reportScript = packageJson.scripts["react:doctor:report"] ?? "";

    expect(reportScript).toContain("--json");
    expect(reportScript).toContain("--blocking none");
  });
});
