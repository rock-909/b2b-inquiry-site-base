import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function collectTypeScriptFiles(directory: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test walks only the fixed repo src/app tree and recursive children
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is derived from the fixed repo src/app tree above
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return collectTypeScriptFiles(absolutePath);
    }

    if (!/\.(?:ts|tsx)$/u.test(entry)) {
      return [];
    }

    return [path.relative(ROOT, absolutePath).split(path.sep).join("/")];
  });
}

describe("test helper boundary", () => {
  it("keeps test-only helpers out of production route roots", () => {
    const misplacedHelpers = collectTypeScriptFiles(path.join(ROOT, "src/app"))
      .filter((file) => !file.includes("/__tests__/"))
      .filter((file) => /(?:^|-)test-/u.test(path.basename(file)));

    expect(misplacedHelpers).toEqual([]);
  });
});
