import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE_FILES = [
  "src/app/api/inquiry/route.ts",
  "src/app/api/health/route.ts",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/contact/contact-page-data.ts",
] as const;

describe("cache directive policy", () => {
  it("keeps critical routes and contact content free of use-cache directives", () => {
    for (const filePath of SOURCE_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取上方固定的仓库文件
      expect(readFileSync(filePath, "utf8"), filePath).not.toMatch(
        /["']use\s+cache["']/iu,
      );
    }
  });
});
