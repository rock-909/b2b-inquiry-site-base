import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  INQUIRY_FORM_CHUNK_MARKER,
  INQUIRY_FORM_MAX_RAW_BYTES,
  INQUIRY_FORM_SOURCE,
  collectClientBoundaryFiles,
  collectForbiddenBuildSources,
  collectInquiryFormBuildArtifactFindings,
  hasTopLevelUseClientDirective,
  runClientBoundaryBudgetCheck,
  runInquiryFormBuildArtifactCheck,
} from "../../../scripts/quality/checks/client-boundary.js";

const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "showcase-client-boundary-test-trash",
);

function createFixture(files: Record<string, string | Buffer>): string {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "showcase-client-boundary-"),
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return rootDir;
}

function moveFixtureToTrash(rootDir: string): void {
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

function writeBudget(rootDir: string, allowedClientBoundaries: string[]): void {
  const budgetPath = path.join(
    rootDir,
    "scripts/quality/config/client-boundary-budget.json",
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.writeFileSync(
    budgetPath,
    `${JSON.stringify(
      {
        version: 1,
        allowedClientBoundaries,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function writeRawBudget(rootDir: string, content: string): void {
  const budgetPath = path.join(
    rootDir,
    "scripts/quality/config/client-boundary-budget.json",
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.writeFileSync(budgetPath, content, "utf8");
}

describe("client-boundary-budget", () => {
  const fixtureRoots: string[] = [];

  afterEach(() => {
    for (const rootDir of fixtureRoots.splice(0)) {
      moveFixtureToTrash(rootDir);
    }
  });

  it("detects top-level use client directives only", () => {
    const rootDir = createFixture({
      "src/components/interactive.tsx": '"use client";\nexport const A = 1;',
      "src/components/single-quote.tsx": "'use client';\nexport const B = 1;",
      "src/components/with-comment.tsx":
        '/** interactive island */\n"use client";\nexport const Commented = 1;',
      "src/components/server.tsx":
        "const marker = 'use client';\nexport const C = 1;",
      "src/components/comment.tsx":
        '// "use client" should not count\nexport const D = 1;',
    });
    fixtureRoots.push(rootDir);

    expect(collectClientBoundaryFiles(rootDir)).toEqual([
      "src/components/interactive.tsx",
      "src/components/single-quote.tsx",
      "src/components/with-comment.tsx",
    ]);
  });

  it("uses Babel directives instead of comments or later strings", () => {
    expect(
      hasTopLevelUseClientDirective('"use client";\nexport const A = 1;'),
    ).toBe(true);
    expect(
      hasTopLevelUseClientDirective(
        'export const text = "use client";\nexport const A = 1;',
      ),
    ).toBe(false);
    expect(
      hasTopLevelUseClientDirective(
        '// "use client"\nexport const text = "server";',
      ),
    ).toBe(false);
  });

  it("excludes tests specs stories mocks fixtures and test utilities", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
      "src/components/live.test.tsx": '"use client";\nexport const Test = 1;',
      "src/components/live.spec.tsx": '"use client";\nexport const Spec = 1;',
      "src/components/live.stories.tsx":
        '"use client";\nexport const Story = 1;',
      "src/components/live.story.tsx": '"use client";\nexport const Story = 1;',
      "src/components/stories/live.tsx":
        '"use client";\nexport const StoryDir = 1;',
      "src/components/storybook/preview.tsx":
        '"use client";\nexport const StorybookPreview = 1;',
      "src/components/.storybook/preview.tsx":
        '"use client";\nexport const DotStorybookPreview = 1;',
      "src/components/mocks/live.tsx":
        '"use client";\nexport const MockDir = 1;',
      "src/components/__tests__/nested.tsx":
        '"use client";\nexport const Nested = 1;',
      "src/components/__mocks__/mock.tsx":
        '"use client";\nexport const Mock = 1;',
      "src/components/__fixtures__/fixture.tsx":
        '"use client";\nexport const Fixture = 1;',
      "src/components/widget.mock.tsx":
        '"use client";\nexport const MockFile = 1;',
      "src/test/helper.tsx": '"use client";\nexport const Helper = 1;',
      "src/testing/render.tsx": '"use client";\nexport const Render = 1;',
    });
    fixtureRoots.push(rootDir);

    expect(collectClientBoundaryFiles(rootDir)).toEqual([
      "src/components/live.tsx",
    ]);
  });

  it("passes when all detected files are allowed and writes a report", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
    });
    fixtureRoots.push(rootDir);
    writeBudget(rootDir, ["src/components/live.tsx"]);

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.unexpectedClientBoundaries).toEqual([]);
    expect(
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- report path is inside a test-owned temporary fixture directory
      fs.existsSync(
        path.join(rootDir, "reports/quality/client-boundary-budget.json"),
      ),
    ).toBe(true);
  });

  it("fails and names unexpected client boundaries", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
      "src/components/new-widget.tsx":
        '"use client";\nexport const Widget = 1;',
    });
    fixtureRoots.push(rootDir);
    writeBudget(rootDir, ["src/components/live.tsx"]);

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("failed");
    expect(result.unexpectedClientBoundaries).toEqual([
      "src/components/new-widget.tsx",
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "unexpected-client-boundary",
          file: "src/components/new-widget.tsx",
        }),
      ]),
    );
  });

  it("fails and names stale budget entries that are no longer client boundaries", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
      "src/components/removed.tsx": "export const Removed = 1;",
    });
    fixtureRoots.push(rootDir);
    writeBudget(rootDir, [
      "src/components/live.tsx",
      "src/components/removed.tsx",
    ]);

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("failed");
    expect(result.staleClientBoundaries).toEqual([
      "src/components/removed.tsx",
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "stale-client-boundary",
          file: "src/components/removed.tsx",
        }),
      ]),
    );
  });

  it("fails when the budget file is missing", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
    });
    fixtureRoots.push(rootDir);

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("failed");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "budget-missing",
          file: "scripts/quality/config/client-boundary-budget.json",
        }),
      ]),
    );
  });

  it("fails when the budget file shape is invalid", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
    });
    fixtureRoots.push(rootDir);
    writeRawBudget(rootDir, JSON.stringify({ version: 1 }));

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("failed");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "budget-invalid",
          file: "scripts/quality/config/client-boundary-budget.json",
        }),
      ]),
    );
  });

  it("fails when the budget file is not valid JSON", () => {
    const rootDir = createFixture({
      "src/components/live.tsx": '"use client";\nexport const Live = 1;',
    });
    fixtureRoots.push(rootDir);
    writeRawBudget(rootDir, "{not-json");

    const result = runClientBoundaryBudgetCheck(rootDir);

    expect(result.status).toBe("failed");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "budget-invalid-json",
          file: "scripts/quality/config/client-boundary-budget.json",
        }),
      ]),
    );
  });
});

function buildInquiryFormChunkFixture(rootDir: string) {
  const chunksDir = path.join(rootDir, ".next/static/chunks");
  const chunkPath = path.join(chunksDir, "inquiry-live.js");
  const mapPath = path.join(chunksDir, "inquiry-live.js.map");
  const chunkBody =
    `export const marker="${INQUIRY_FORM_CHUNK_MARKER}";`.padEnd(512, "/");

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.mkdirSync(chunksDir, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.writeFileSync(
    chunkPath,
    `${chunkBody}\n//# sourceMappingURL=inquiry-live.js.map\n`,
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
  fs.writeFileSync(
    mapPath,
    `${JSON.stringify({
      version: 3,
      sources: [
        `turbopack:///[project]/${INQUIRY_FORM_SOURCE}`,
        "turbopack:///[project]/src/components/forms/inquiry-form-fields.tsx",
      ],
    })}\n`,
  );
}

describe("client-boundary build artifacts", () => {
  const fixtureRoots: string[] = [];

  afterEach(() => {
    for (const rootDir of fixtureRoots.splice(0)) {
      moveFixtureToTrash(rootDir);
    }
  });

  it("hard fails when build output is missing", () => {
    const rootDir = createFixture({});
    fixtureRoots.push(rootDir);

    expect(collectInquiryFormBuildArtifactFindings(rootDir)).toEqual([
      {
        error:
          "missing Next.js client chunk output at .next/static/chunks; run pnpm build first",
      },
    ]);
  });

  it("passes when exactly one InquiryForm chunk and sourcemap are present", () => {
    const rootDir = createFixture({});
    buildInquiryFormChunkFixture(rootDir);
    fixtureRoots.push(rootDir);

    const result = collectInquiryFormBuildArtifactFindings(rootDir);
    expect(Array.isArray(result)).toBe(false);
    if (Array.isArray(result)) {
      throw new Error("expected passing result object");
    }

    expect(result.status).toBe("passed");
    expect(result.chunkPath).toBe(".next/static/chunks/inquiry-live.js");
    expect(result.rawBytes).toBeLessThan(INQUIRY_FORM_MAX_RAW_BYTES);
    expect(result.forbiddenSources).toEqual([]);
  });

  it("measures rawBytes as utf-8 file bytes, not js string length", () => {
    const rootDir = createFixture({});
    const chunksDir = path.join(rootDir, ".next/static/chunks");
    const chunkPath = path.join(chunksDir, "inquiry-live.js");
    const mapPath = path.join(chunksDir, "inquiry-live.js.map");
    const chunkBody = `export const marker="${INQUIRY_FORM_CHUNK_MARKER}"; export const euro="€";`;
    const chunkText = `${chunkBody}\n//# sourceMappingURL=inquiry-live.js.map\n`;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(chunksDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(chunkPath, chunkText, "utf8");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      mapPath,
      `${JSON.stringify({
        version: 3,
        sources: [`turbopack:///[project]/${INQUIRY_FORM_SOURCE}`],
      })}\n`,
    );
    fixtureRoots.push(rootDir);

    const result = collectInquiryFormBuildArtifactFindings(rootDir);
    expect(Array.isArray(result)).toBe(false);
    if (Array.isArray(result)) {
      throw new Error("expected passing result object");
    }

    expect(result.rawBytes).toBe(Buffer.byteLength(chunkText, "utf8"));
    expect(result.rawBytes).toBeGreaterThan(chunkText.length);
  });

  it("fails when the paired InquiryForm sourcemap pulls in forbidden dependencies", () => {
    const rootDir = createFixture({});
    buildInquiryFormChunkFixture(rootDir);
    const mapPath = path.join(
      rootDir,
      ".next/static/chunks/inquiry-live.js.map",
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      mapPath,
      `${JSON.stringify({
        version: 3,
        sources: [
          `turbopack:///[project]/${INQUIRY_FORM_SOURCE}`,
          "turbopack:///[project]/node_modules/zod/v4/core/core.js",
        ],
      })}\n`,
    );
    fixtureRoots.push(rootDir);

    expect(collectInquiryFormBuildArtifactFindings(rootDir)).toEqual([
      {
        error:
          "forbidden InquiryForm client dependency in sourcemap: zod: turbopack:///[project]/node_modules/zod/v4/core/core.js",
      },
    ]);
  });

  it("fails when an unrelated safe sourcemap would have passed the old map scan", () => {
    const rootDir = createFixture({});
    const chunksDir = path.join(rootDir, ".next/static/chunks");
    const actualChunkPath = path.join(chunksDir, "actual-inquiry.js");
    const actualMapPath = path.join(chunksDir, "actual-inquiry.js.map");
    const unrelatedSafeMapPath = path.join(chunksDir, "unrelated-safe.js.map");

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(chunksDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      actualChunkPath,
      `export const marker="${INQUIRY_FORM_CHUNK_MARKER}";\n//# sourceMappingURL=actual-inquiry.js.map\n`,
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      actualMapPath,
      `${JSON.stringify({
        version: 3,
        sources: [
          `turbopack:///[project]/${INQUIRY_FORM_SOURCE}`,
          "turbopack:///[project]/node_modules/zod/v4/core/core.js",
        ],
      })}\n`,
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      unrelatedSafeMapPath,
      `${JSON.stringify({
        version: 3,
        sources: [
          `turbopack:///[project]/${INQUIRY_FORM_SOURCE}`,
          "turbopack:///[project]/src/components/forms/inquiry-form-fields.tsx",
        ],
      })}\n`,
    );
    fixtureRoots.push(rootDir);

    expect(collectInquiryFormBuildArtifactFindings(rootDir)).toEqual([
      {
        error:
          "forbidden InquiryForm client dependency in sourcemap: zod: turbopack:///[project]/node_modules/zod/v4/core/core.js",
      },
    ]);
  });

  it("fails when the InquiryForm chunk is missing //# sourceMappingURL", () => {
    const rootDir = createFixture({});
    const chunksDir = path.join(rootDir, ".next/static/chunks");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(chunksDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      path.join(chunksDir, "actual-inquiry.js"),
      `export const marker="${INQUIRY_FORM_CHUNK_MARKER}";\n`,
    );
    fixtureRoots.push(rootDir);

    expect(collectInquiryFormBuildArtifactFindings(rootDir)).toEqual([
      {
        error:
          "InquiryForm client chunk is missing //# sourceMappingURL declaration",
      },
    ]);
  });

  it("fails when //# sourceMappingURL escapes .next/static/chunks", () => {
    const rootDir = createFixture({});
    const chunksDir = path.join(rootDir, ".next/static/chunks");
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(chunksDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(
      path.join(chunksDir, "actual-inquiry.js"),
      `export const marker="${INQUIRY_FORM_CHUNK_MARKER}";\n//# sourceMappingURL=../outside.js.map\n`,
    );
    fixtureRoots.push(rootDir);

    expect(collectInquiryFormBuildArtifactFindings(rootDir)).toEqual([
      {
        error:
          'InquiryForm client chunk sourceMappingURL must stay inside .next/static/chunks, got "../outside.js.map"',
      },
    ]);
  });

  it("writes a failure report from the build-artifact helper", () => {
    const rootDir = createFixture({});
    fixtureRoots.push(rootDir);

    const result = runInquiryFormBuildArtifactCheck(rootDir);
    expect(result.status).toBe("failed");
    expect(
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- report path is inside a test-owned temporary fixture directory
      fs.readFileSync(
        path.join(rootDir, "reports/quality/client-boundary-budget.json"),
        "utf8",
      ),
    ).toContain("missing Next.js client chunk output");
  });

  it("flags forbidden source patterns used by the build gate", () => {
    expect(
      collectForbiddenBuildSources([
        `turbopack:///[project]/${INQUIRY_FORM_SOURCE}`,
        "turbopack:///[project]/src/config/public-trust.ts",
      ]),
    ).toEqual([
      "public-trust: turbopack:///[project]/src/config/public-trust.ts",
    ]);
  });
});
