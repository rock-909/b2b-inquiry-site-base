import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  READY_PUBLIC_LAUNCH_FIXTURE,
  type PublicLaunchFixture,
} from "./production-config-fixtures";
import { validateProductionConfig } from "../../../scripts/quality/checks/production-config.js";

// 占位与格式只在上线门禁判断（运行时原样输出已填字段），这里证明门禁照旧拦截。
describe("public launch identity values", () => {
  const READY = READY_PUBLIC_LAUNCH_FIXTURE.SINGLE_SITE_CONFIG;

  // 空目录：不扫仓库文件，只看站点身份相关的报错。
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "b2b-identity-"));

  function identityErrors(
    config: Partial<PublicLaunchFixture["SINGLE_SITE_CONFIG"]>,
  ): string[] {
    const { errors } = validateProductionConfig(
      {
        APP_ENV: "preview",
        NODE_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
      },
      {
        rootDir,
        publicLaunch: { SINGLE_SITE_CONFIG: { ...READY, ...config } },
      },
    );
    return errors.filter(
      (error: string) =>
        error.startsWith("SITE_CONFIG.") || error.startsWith("brandAssets."),
    );
  }

  it("blocks placeholder or malformed contact email and phone", () => {
    for (const email of [
      "",
      "not-an-email",
      " sales@reference-site.com",
      "sales@example.com",
      "sales@example.invalid",
      "starter-contact@example.com",
      "sales@asterconveyor.example",
      "sales@acme.test",
    ])
      expect(identityErrors({ contact: { email } })).toEqual([
        expect.stringContaining("SITE_CONFIG.contact.email"),
      ]);
    for (const phone of [
      "call me",
      "-------",
      "TODO-OWNER",
      "+86-518-0000-0000",
      "+1-312-555-0198",
    ])
      expect(identityErrors({ contact: { ...READY.contact, phone } })).toEqual([
        expect.stringContaining("SITE_CONFIG.contact.phone"),
      ]);
    expect(
      identityErrors({
        contact: { email: "hello@starter.dev", phone: "+86-138-0013-8000" },
      }),
    ).toEqual([]);
  });

  it("blocks sentinel company names and explicit TODO markers but accepts real names", () => {
    for (const name of [
      "Northstar Industrial Reference",
      "B2B Inquiry Template",
      "Replace before launch",
      "Placeholder company",
      "TODO",
      "TODO-OWNER",
      "TODO: company name",
      "[TODO]",
    ])
      expect(identityErrors({ company: { name } })).toEqual([
        expect.stringContaining("SITE_CONFIG.company.name"),
      ]);
    for (const name of [
      "Northstar Manufacturing",
      "Todo Industries",
      "Todo-Industries",
      "Todorov Engineering",
    ])
      expect(identityErrors({ company: { name } })).toEqual([]);
    expect(
      identityErrors({
        company: { name: "Acme", location: { city: "Example City" } },
      }),
    ).toEqual([expect.stringContaining("SITE_CONFIG.company.location.city")]);
  });

  it("blocks placeholder social profiles but accepts real ones", () => {
    for (const twitter of [
      "https://x.com/example",
      "http://x.com/acme",
      "https://acme.invalid/profile",
      " https://x.com/acme",
    ])
      expect(identityErrors({ social: { twitter } })).toEqual([
        expect.stringContaining("SITE_CONFIG.social.twitter"),
      ]);
    for (const linkedin of [
      "https://linkedin.com/company/northstar-manufacturing",
      "https://linkedin.com/company/todo-industries",
      "https://todo.com/profile",
    ])
      expect(identityErrors({ social: { linkedin } })).toEqual([]);
  });

  it("accepts a ready local logo but blocks pending and cross-origin logos", () => {
    const logo = { status: "ready" as const, width: 240, height: 72 };
    const withLogo = (
      next: NonNullable<
        PublicLaunchFixture["SINGLE_SITE_CONFIG"]["brandAssets"]["logo"]
      >,
    ) => identityErrors({ brandAssets: { ...READY.brandAssets, logo: next } });

    expect(withLogo({ ...logo, horizontal: "/images/logo.svg" })).toEqual([]);
    for (const next of [
      { ...logo, horizontal: "/logo.svg", status: "pending" as const },
      { ...logo, horizontal: String.raw`/\cdn.invalid/logo.svg` },
      { ...logo, horizontal: "//cdn.invalid/logo.svg" },
      { ...logo, horizontal: "https://cdn.invalid/logo.svg" },
      { ...logo, horizontal: String.raw`/images\logo.svg` },
    ])
      expect(withLogo(next)).toEqual([
        expect.stringContaining("brandAssets.logo"),
      ]);
  });
});
