import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";
import { collectMissingAirtableCanaryInputs } from "../../scripts/quality/checks/airtable-canary.js";
import { isDeployedCanaryUrl } from "../e2e/smoke/post-deploy-canary-url";

describe("Airtable write canary boundary", () => {
  it("does not treat local URLs as deployed canary targets", () => {
    expect(isDeployedCanaryUrl(undefined)).toBe(false);
    expect(isDeployedCanaryUrl("not a url")).toBe(false);
    expect(isDeployedCanaryUrl("http://localhost:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://127.0.0.1:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://[::1]:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://0.0.0.0:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://10.0.0.5:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://172.16.0.5:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://172.31.0.5:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://192.168.1.10:3000")).toBe(false);
    expect(isDeployedCanaryUrl("http://starter.local:3000")).toBe(false);
    expect(isDeployedCanaryUrl("file:///tmp/reference-site")).toBe(false);
    expect(isDeployedCanaryUrl("https://preview.example.com")).toBe(true);
  });

  it("lists every missing prerequisite before Playwright starts", () => {
    expect(collectMissingAirtableCanaryInputs({})).toEqual([
      "STAGING_URL or PLAYWRIGHT_BASE_URL (deployed HTTPS URL)",
      "AIRTABLE_BASE_ID",
      "AIRTABLE_API_KEY",
    ]);

    const result = spawnSync("pnpm", ["canary:airtable"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        STAGING_URL: "",
        PLAYWRIGHT_BASE_URL: "",
        AIRTABLE_BASE_ID: "",
        AIRTABLE_API_KEY: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr.match(/Airtable canary 缺少前置条件/gu)).toHaveLength(
      1,
    );
    expect(result.stderr).toContain("AIRTABLE_BASE_ID");
    expect(result.stderr).toContain("AIRTABLE_API_KEY");
  });
});
