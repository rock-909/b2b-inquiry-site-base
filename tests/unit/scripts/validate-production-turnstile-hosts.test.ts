import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";

const GATE_PATH = path.resolve("scripts/quality/checks/production-config.js");
const SITE_URL = "https://www.reference-site.com";
const HOSTS_KEY = "env.production.vars.TURNSTILE_ALLOWED_HOSTS";
const FIXTURE_PREFIX = "turnstile-hosts-";
const tempDirs: string[] = [];

function turnstileHostErrors(hosts: string | undefined, siteUrl = SITE_URL) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  tempDirs.push(cwd);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp directory
  writeFileSync(
    path.join(cwd, "wrangler.jsonc"),
    JSON.stringify({
      env: {
        production: {
          vars: {
            NEXT_PUBLIC_SITE_URL: siteUrl,
            NEXT_PUBLIC_BASE_URL: siteUrl,
            ...(hosts === undefined ? {} : { TURNSTILE_ALLOWED_HOSTS: hosts }),
          },
        },
      },
    }),
  );

  const result = spawnSync(process.execPath, [GATE_PATH], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      TSX_TSCONFIG_PATH: path.resolve("tsconfig.json"),
      APP_ENV: "preview",
      PUBLIC_LAUNCH_STRICT: "true",
    },
  });
  return result.stderr.split("\n").filter((line) => line.includes(HOSTS_KEY));
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

describe("production gate for Wrangler TURNSTILE_ALLOWED_HOSTS", () => {
  it.each([
    ["a placeholder host", "example.invalid", "https://example.invalid"],
    ["a list without the site hostname", "other-site.com", SITE_URL],
    [
      "a site hostname mixed with a local host",
      "www.reference-site.com,localhost",
      SITE_URL,
    ],
  ])("rejects %s", (_name, hosts, siteUrl) => {
    expect(turnstileHostErrors(hosts, siteUrl)).toHaveLength(1);
  });

  it.each([
    [
      "the site hostname among other real hosts",
      " WWW.reference-site.com , reference-site.com",
    ],
    ["no value (runtime falls back to the site URL)", undefined],
  ])("accepts %s", (_name, hosts) => {
    expect(turnstileHostErrors(hosts)).toEqual([]);
  });
});
