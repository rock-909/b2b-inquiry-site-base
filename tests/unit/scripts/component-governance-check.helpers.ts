import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "vitest";

export interface ComponentGovernanceFinding {
  file: string;
  line: number;
  kind: string;
  detail: string;
}

const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "showcase-component-governance-test-trash",
);

export function createFixture(files: Record<string, string>): string {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "showcase-component-governance-"),
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is created inside a test-owned temporary directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is created inside a test-owned temporary directory
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return rootDir;
}

export function moveFixtureToTrash(rootDir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup only checks the test-owned temporary fixture directory
  if (!fs.existsSync(rootDir)) return;

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable os.tmpdir trash folder
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  const targetDir = path.join(
    TEMP_TRASH_ROOT,
    `${path.basename(rootDir)}-${Date.now()}`,
  );

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture cleanup uses recoverable rename instead of permanent deletion
  fs.renameSync(rootDir, targetDir);
}

export const VALID_BUTTON_REGISTRY_ITEM = {
  story: "required",
  radixLayer: "primitive",
  clientBoundary: "server-safe",
};

export function registry(components: Record<string, unknown>): string {
  return JSON.stringify({ version: 1, components }, null, 2);
}

export function baseFiles(extraFiles: Record<string, string> = {}) {
  return {
    "src/components/component-governance.registry.json": registry({
      button: VALID_BUTTON_REGISTRY_ITEM,
    }),
    "src/components/ui/button.tsx":
      'import { Slot } from "@radix-ui/react-slot";\nexport function Button() { return <Slot />; }',
    "src/components/ui/button.stories.tsx":
      "export default { title: 'UI/Button' };",
    ...extraFiles,
  };
}

export function expectFinding(
  findings: ComponentGovernanceFinding[],
  kind: string,
  file?: string,
): void {
  expect(findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind,
        ...(file ? { file } : {}),
      }),
    ]),
  );
}
