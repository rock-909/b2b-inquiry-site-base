import { describe, expect, it } from "vitest";
import { isPublicBaseUrlReady } from "../../../scripts/quality/public-url-readiness.js";

// 生产公开地址必须是公网域名：IP 字面量、内网段、单标签主机和带尾点的保留域名都不行。
describe("production public URL readiness", () => {
  it.each([
    "https://127.0.0.2",
    "https://10.0.0.1",
    "https://192.168.1.10",
    "https://169.254.169.254",
    "https://203.0.113.10",
    "https://[fc00::1]",
    "https://[fd12:3456::1]",
    "https://intranet",
    "https://example.invalid.",
    "https://localhost.",
    "https://reference-site.workers.dev.",
  ])("rejects %s", (url) => {
    expect(isPublicBaseUrlReady(url)).toBe(false);
  });

  it.each(["https://acme-industrial.com", "https://www.acme-industrial.co.uk"])(
    "accepts %s",
    (url) => {
      expect(isPublicBaseUrlReady(url)).toBe(true);
    },
  );
});
