/* eslint-disable security/detect-non-literal-fs-filename -- test-owned temp fixtures under os.tmpdir(); paths are created by this test and moved to test Trash */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";
import {
  collectCloudflareStaticAssetHeaderFailures,
  runCloudflareStaticAssetHeaderCli,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

const tempDirs: string[] = [];
const FIXTURE_PREFIX = "b2b-static-headers-";
const GOOD_HEADERS = `/_next/static/*
  Cache-Control: public,max-age=31536000,immutable

/images/*
  Cache-Control: public,max-age=86400
`;

function createFixture(headers = GOOD_HEADERS): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  tempDirs.push(rootDir);

  for (const repoPath of ["public/_headers", ".open-next/assets/_headers"]) {
    const filePath = path.join(rootDir, repoPath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, headers);
  }

  return rootDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

describe("Cloudflare static asset headers", () => {
  it("accepts the source and built static bundle cache rule", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({ rootDir: createFixture() }),
    ).toEqual([]);
  });

  it("fails when the long-lived bundle cache rule is weakened", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`/_next/static/*
  Cache-Control: public,max-age=60
`),
      }),
    ).toEqual([
      "public/_headers /_next/static/* must keep Cache-Control directives: public, max-age=31536000, immutable",
      ".open-next/assets/_headers /_next/static/* must keep Cache-Control directives: public, max-age=31536000, immutable",
    ]);
  });

  it.each(["no-store", "no-cache", "private"])(
    "fails when %s cancels the long-lived cache rule",
    (directive) => {
      expect(
        collectCloudflareStaticAssetHeaderFailures({
          rootDir: createFixture(`/_next/static/*
  Cache-Control: public,max-age=31536000,immutable,${directive}
`),
        }),
      ).toEqual([
        `public/_headers /_next/static/* must not include Cache-Control directive: ${directive}`,
        `.open-next/assets/_headers /_next/static/* must not include Cache-Control directive: ${directive}`,
      ]);
    },
  );

  it("fails when no-store has a value", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`/_next/static/*
  Cache-Control: public,max-age=31536000,immutable,no-store=1
`),
      }),
    ).toEqual([
      "public/_headers /_next/static/* must not include Cache-Control directive: no-store",
      ".open-next/assets/_headers /_next/static/* must not include Cache-Control directive: no-store",
    ]);
  });

  it("fails when s-maxage disables shared cache", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`/_next/static/*
  Cache-Control: public,max-age=31536000,immutable,s-maxage=0
`),
      }),
    ).toEqual([
      "public/_headers /_next/static/* must not include Cache-Control directive: s-maxage",
      ".open-next/assets/_headers /_next/static/* must not include Cache-Control directive: s-maxage",
    ]);
  });

  it("fails when a more specific static block disables bundle caching", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`${GOOD_HEADERS}
/_next/static/chunks/*
  Cache-Control: no-store
`),
      }),
    ).toEqual([
      "public/_headers /_next/static/chunks/* must not include Cache-Control directive: no-store",
      ".open-next/assets/_headers /_next/static/chunks/* must not include Cache-Control directive: no-store",
    ]);
  });

  it("fails when a splat-style static block disables bundle caching", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`${GOOD_HEADERS}
/_next/static*
  Cache-Control: no-store
`),
      }),
    ).toEqual([
      "public/_headers /_next/static* must not include Cache-Control directive: no-store",
      ".open-next/assets/_headers /_next/static* must not include Cache-Control directive: no-store",
    ]);
  });

  it("fails when a duplicate static route hides a bad first block", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`/_next/static/*
  Cache-Control: no-store

/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
`),
      }),
    ).toEqual([
      "public/_headers /_next/static/* must not include Cache-Control directive: no-store",
      ".open-next/assets/_headers /_next/static/* must not include Cache-Control directive: no-store",
    ]);
  });

  it("fails when a host-qualified static block disables bundle caching", () => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(`${GOOD_HEADERS}
https://example.com/_next/static*
  Cache-Control: no-store
`),
      }),
    ).toEqual([
      "public/_headers https://example.com/_next/static* must not include Cache-Control directive: no-store",
      ".open-next/assets/_headers https://example.com/_next/static* must not include Cache-Control directive: no-store",
    ]);
  });

  it.each([
    [
      "specific chunks",
      `${GOOD_HEADERS}/_next/static/chunks/*\n  ! Cache-Control\n`,
      "/_next/static/chunks/*",
    ],
    [
      "splat",
      `${GOOD_HEADERS}/_next/static*\n  ! Cache-Control\n`,
      "/_next/static*",
    ],
    [
      "absolute host",
      `${GOOD_HEADERS}https://example.com/_next/static*\n  ! Cache-Control\n`,
      "https://example.com/_next/static*",
    ],
    [
      "duplicate exact after good",
      `${GOOD_HEADERS}/_next/static/*\n  ! Cache-Control\n`,
      "/_next/static/*",
    ],
  ])("fails when %s unsets Cache-Control", (_case, headers, route) => {
    expect(
      collectCloudflareStaticAssetHeaderFailures({
        rootDir: createFixture(headers),
      }),
    ).toEqual([
      `public/_headers ${route} must not unset Cache-Control`,
      `.open-next/assets/_headers ${route} must not unset Cache-Control`,
    ]);
  });

  it("runs the direct checker", () => {
    expect(
      runCloudflareStaticAssetHeaderCli({ rootDir: createFixture() }),
    ).toBe(true);
  });
});
