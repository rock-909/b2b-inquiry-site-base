import { describe, expect, it } from "vitest";
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
    expect(isDeployedCanaryUrl("file:///tmp/showcase")).toBe(false);
    expect(isDeployedCanaryUrl("https://preview.example.com")).toBe(true);
  });
});
