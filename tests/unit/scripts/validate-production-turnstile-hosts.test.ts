import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { READY_PUBLIC_LAUNCH_FIXTURE } from "./production-config-fixtures";
import { validateProductionConfig } from "../../../scripts/quality/checks/production-config.js";

const SITE_URL = "https://www.reference-site.com";
const HOSTS_KEY = "env.production.vars.TURNSTILE_ALLOWED_HOSTS";
const FIXTURE_PREFIX = "turnstile-hosts-";

// 进程内调用门禁（真实 CLI 路径由 validate-production-config 的严格 CLI 用例证明）。
function turnstileHostErrors(hosts: string | undefined, siteUrl = SITE_URL) {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp directory
  writeFileSync(
    path.join(rootDir, "wrangler.jsonc"),
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

  const { errors } = validateProductionConfig(
    { NODE_ENV: "test", APP_ENV: "preview", PUBLIC_LAUNCH_STRICT: "true" },
    { rootDir, publicLaunch: READY_PUBLIC_LAUNCH_FIXTURE },
  );
  return errors.filter((error: string) => error.includes(HOSTS_KEY));
}

describe("production gate for Wrangler TURNSTILE_ALLOWED_HOSTS", () => {
  it.each([
    ["a missing value", undefined, SITE_URL],
    ["an empty value", "", SITE_URL],
    ["a whitespace-only value", " \t ", SITE_URL],
    ["an empty host list", " , , ", SITE_URL],
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
  ])("accepts %s", (_name, hosts) => {
    expect(turnstileHostErrors(hosts)).toEqual([]);
  });
});
