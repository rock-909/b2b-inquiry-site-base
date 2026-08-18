import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";
import {
  INQUIRY_FORM_CHUNK_MARKER,
  INQUIRY_FORM_MAX_RAW_BYTES,
  INQUIRY_FORM_SOURCE,
  collectForbiddenBuildSources,
  collectInquiryFormBuildArtifactFindings,
  runInquiryFormBuildArtifactCheck,
} from "../../../scripts/quality/checks/client-boundary.js";

const FIXTURE_PREFIX = "b2b-inquiry-client-boundary-";

function createFixture(files: Record<string, string | Buffer>): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return rootDir;
}

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
      moveOwnedTempDirectoryToTrash(rootDir, FIXTURE_PREFIX);
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
        path.join(rootDir, "reports/quality/client-boundary.json"),
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
