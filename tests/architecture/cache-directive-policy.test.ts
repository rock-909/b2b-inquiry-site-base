import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE_FILES = [
  "src/app/api/inquiry/route.ts",
  "src/app/api/health/route.ts",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/contact/contact-page-data.ts",
] as const;

describe("cache directive policy", () => {
  it("keeps critical routes and contact content free of runtime cache directives", () => {
    for (const filePath of SOURCE_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 架构测试只读取 SOURCE_FILES 固定仓库文件
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/["']use\s+cache["']/iu);
      expect(source, filePath).not.toMatch(/from\s+["']next\/cache["']/u);
      expect(source, filePath).not.toMatch(
        /\b(?:cacheTag|cacheLife|revalidateTag|revalidatePath|updateTag)\s*\(/u,
      );
    }
  });
});
