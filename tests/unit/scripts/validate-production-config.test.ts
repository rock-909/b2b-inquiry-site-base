import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { load } from "js-yaml";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  STARTER_PUBLIC_LAUNCH_FIXTURE,
  READY_PUBLIC_LAUNCH_FIXTURE,
  type PublicLaunchFixture,
} from "./production-config-fixtures";
import {
  isSentinelBlocker,
  shouldValidateProductionRuntimeContract,
  validateProductionConfig,
  validateProductionRuntimeContract,
} from "../../../scripts/quality/checks/production-config.js";

function createChildEnv(
  overrides: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("VITEST")),
  );

  return {
    NODE_ENV: process.env.NODE_ENV ?? "test",
    ...env,
    ...overrides,
  };
}

function createValidProductionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DEPLOYMENT_PLATFORM: "cloudflare",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "upstash-token",
    RATE_LIMIT_PEPPER: "a".repeat(32),
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
    EMAIL_FROM: "noreply@example.com",
    INQUIRY_RECIPIENT_EMAIL: "sales@example.com",
    RESEND_API_KEY: "resend-api-key",
    AIRTABLE_API_KEY: "airtable-api-key",
    AIRTABLE_BASE_ID: "appBaseId",
    NEXT_PUBLIC_TEST_MODE: "false",
    SECURITY_HEADERS_ENABLED: "true",
    NEXT_PUBLIC_SECURITY_MODE: "strict",
  };
}

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowDocument {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");
const FIXTURE_PREFIX = "b2b-inquiry-production-";

function loadDeployWorkflowSteps(): WorkflowStep[] {
  const workflow = load(
    readFileSync(
      path.join(ROOT_DIR, ".github/workflows/cloudflare-deploy.yml"),
      "utf8",
    ),
  ) as WorkflowDocument;

  return workflow.jobs?.["build-and-deploy"]?.steps ?? [];
}

function getNodeHeredoc(exportScript: string): string | undefined {
  const nodeScript = exportScript.match(
    /node <<'NODE'\n([\s\S]*?)\nNODE(?:\n|$)/,
  );

  return nodeScript?.[1];
}

function executeProductionExport(exportScript: string): {
  status: number | null;
  stderr: string;
  exportedLines: string[];
} {
  const nodeScript = getNodeHeredoc(exportScript);
  if (!nodeScript) {
    return {
      status: null,
      stderr: "Node heredoc is missing",
      exportedLines: [],
    };
  }

  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), `${FIXTURE_PREFIX}export-`),
  );
  const githubEnvPath = path.join(tempDir, "github-env");
  const result = spawnSync(process.execPath, ["-e", nodeScript], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: createChildEnv({ GITHUB_ENV: githubEnvPath }),
  });

  return {
    status: result.status,
    stderr: result.stderr,
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is inside the test-owned temp directory
    exportedLines: existsSync(githubEnvPath)
      ? // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is inside the test-owned temp directory
        readFileSync(githubEnvPath, "utf8").trimEnd().split("\n")
      : [],
  };
}

function createPublicLaunchInput(
  publicLaunch: PublicLaunchFixture = STARTER_PUBLIC_LAUNCH_FIXTURE,
  baseUrl = "https://reference-site.com",
) {
  const rootDir = mkdtempSync(
    path.join(os.tmpdir(), `${FIXTURE_PREFIX}config-`),
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 写入本测试刚创建的临时目录
  writeFileSync(
    path.join(rootDir, "wrangler.jsonc"),
    JSON.stringify({
      name: "reference-site",
      env: {
        preview: {},
        production: {
          vars: {
            NEXT_PUBLIC_SITE_URL: baseUrl,
            NEXT_PUBLIC_BASE_URL: baseUrl,
            TURNSTILE_ALLOWED_HOSTS: new URL(baseUrl).hostname,
          },
        },
      },
    }),
  );
  return { rootDir, publicLaunch };
}

describe("validate-production-config runtime contract", () => {
  it("enables strict runtime validation only in production mode", () => {
    expect(
      shouldValidateProductionRuntimeContract({
        APP_ENV: "preview",
        NODE_ENV: "test",
      }),
    ).toBe(false);
    expect(
      shouldValidateProductionRuntimeContract({
        APP_ENV: "production",
        NODE_ENV: "test",
      }),
    ).toBe(true);
    expect(
      shouldValidateProductionRuntimeContract({ NODE_ENV: "production" }),
    ).toBe(true);
    expect(
      shouldValidateProductionRuntimeContract({ NODE_ENV: "development" }),
    ).toBe(false);
    expect(shouldValidateProductionRuntimeContract({ NODE_ENV: "test" })).toBe(
      false,
    );
  });

  it("passes when the release-critical production contract is satisfied", () => {
    const result = validateProductionRuntimeContract(
      createValidProductionEnv(),
    );

    expect(result.errors).toEqual([]);
  });

  it.each([
    ["NEXT_PUBLIC_TEST_MODE", "true"],
    ["SECURITY_HEADERS_ENABLED", "false"],
    ["NEXT_PUBLIC_SECURITY_MODE", "relaxed"],
    // APP_ENV=production 时 NODE_ENV 仍会进入运行时：开发/测试值会打开开发分支。
    ["NODE_ENV", "development"],
    ["NODE_ENV", "test"],
    ["TURNSTILE_BYPASS", "true"],
  ] as const)("rejects production %s=%s", (key, value) => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      APP_ENV: "production",
      [key]: value,
    });

    expect(result.errors).toEqual([expect.stringContaining(`${key}=${value}`)]);
  });

  // 取值抄自 Cloudflare Turnstile 测试文档：测试 sitekey 让真实访客的令牌在主机名校验失败，
  // 测试 secret 只认假令牌。
  it.each([
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "2x00000000000000000000AB"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000BB"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "2x00000000000000000000BB"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "3x00000000000000000000FF"],
    ["TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA"],
    ["TURNSTILE_SECRET_KEY", "2x0000000000000000000000000000000AA"],
    ["TURNSTILE_SECRET_KEY", "3x0000000000000000000000000000000AA"],
  ])("rejects the official Turnstile test key %s=%s", (key, value) => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      [key]: value,
    });

    expect(result.errors).toEqual([expect.stringContaining(key)]);
  });

  it("reports every unsafe production switch in one pass", () => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      NEXT_PUBLIC_TEST_MODE: "true",
      SECURITY_HEADERS_ENABLED: "false",
      NEXT_PUBLIC_SECURITY_MODE: "relaxed",
    });

    expect(result.errors).toEqual([
      expect.stringContaining("NEXT_PUBLIC_TEST_MODE=true"),
      expect.stringContaining("SECURITY_HEADERS_ENABLED=false"),
      expect.stringContaining("NEXT_PUBLIC_SECURITY_MODE=relaxed"),
    ]);
  });

  it("exports safe production public switches before the runtime contract gate", () => {
    const wranglerPath = path.join(ROOT_DIR, "wrangler.jsonc");
    const parsedWrangler = ts.parseConfigFileTextToJson(
      wranglerPath,
      readFileSync(wranglerPath, "utf8"),
    );
    const steps = loadDeployWorkflowSteps();
    const exportStepIndex = steps.findIndex(
      (step) => step.name === "导出 production public vars（wrangler）",
    );
    const gateStepIndex = steps.findIndex(
      (step) => step.name === "阻断：production 严格上线配置",
    );
    const exportScript = steps[exportStepIndex]?.run ?? "";
    const productionVars = parsedWrangler.config?.env?.production?.vars;

    expect(parsedWrangler.error).toBeUndefined();
    expect(exportStepIndex).toBeGreaterThanOrEqual(0);
    expect(gateStepIndex).toBeGreaterThan(exportStepIndex);
    expect(productionVars).toMatchObject({
      NEXT_PUBLIC_TEST_MODE: "false",
      SECURITY_HEADERS_ENABLED: "true",
      NEXT_PUBLIC_SECURITY_MODE: "strict",
    });
    const execution = executeProductionExport(exportScript);
    expect(execution.status, execution.stderr).toBe(0);
    expect(execution.exportedLines).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_TEST_MODE=false",
        "SECURITY_HEADERS_ENABLED=true",
        "NEXT_PUBLIC_SECURITY_MODE=strict",
      ]),
    );
  });

  it("fails when production DEPLOYMENT_PLATFORM is not canonical cloudflare", () => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      DEPLOYMENT_PLATFORM: "self-hosted",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DEPLOYMENT_PLATFORM must be "cloudflare"'),
      ]),
    );
  });

  it("fails when production DEPLOYMENT_PLATFORM is missing", () => {
    const env = createValidProductionEnv();
    delete env.DEPLOYMENT_PLATFORM;

    const result = validateProductionRuntimeContract(env);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DEPLOYMENT_PLATFORM must be "cloudflare"'),
      ]),
    );
  });

  it("fails fast on partial store configuration", () => {
    const partialUpstash = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    expect(partialUpstash.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Production rate limiting requires Upstash Redis",
        ),
      ]),
    );
  });

  it("fails when lead-path or secret requirements are missing or too short", () => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      RATE_LIMIT_PEPPER: "short",
      TURNSTILE_SECRET_KEY: undefined,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined,
      EMAIL_FROM: undefined,
      INQUIRY_RECIPIENT_EMAIL: undefined,
      RESEND_API_KEY: undefined,
      AIRTABLE_API_KEY: undefined,
      AIRTABLE_BASE_ID: undefined,
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "RATE_LIMIT_PEPPER must be at least 32 characters",
        ),
        expect.stringContaining("TURNSTILE_SECRET_KEY is required"),
        expect.stringContaining("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required"),
        expect.stringContaining("EMAIL_FROM is required"),
        expect.stringContaining("INQUIRY_RECIPIENT_EMAIL is required"),
        expect.stringContaining("RESEND_API_KEY is required"),
        expect.stringContaining("AIRTABLE_API_KEY is required"),
        expect.stringContaining("AIRTABLE_BASE_ID is required"),
      ]),
    );
  });

  it.each([
    {
      name: "Upstash",
      remove: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      message: "Production rate limiting requires Upstash Redis",
    },
    {
      name: "rate-limit pepper",
      remove: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER is required",
    },
    {
      name: "Resend",
      remove: ["RESEND_API_KEY"],
      message: "RESEND_API_KEY is required",
    },
    {
      name: "sender email",
      remove: ["EMAIL_FROM"],
      message: "EMAIL_FROM is required",
    },
    {
      name: "inquiry recipient",
      remove: ["INQUIRY_RECIPIENT_EMAIL"],
      message: "INQUIRY_RECIPIENT_EMAIL is required",
    },
    {
      name: "Airtable API key",
      remove: ["AIRTABLE_API_KEY"],
      message: "AIRTABLE_API_KEY is required",
    },
    {
      name: "Airtable base",
      remove: ["AIRTABLE_BASE_ID"],
      message: "AIRTABLE_BASE_ID is required",
    },
  ])(
    "fails closed when a complete production fixture loses $name",
    (fixture) => {
      const env = createValidProductionEnv();
      for (const key of fixture.remove) {
        delete env[key];
      }

      const result = validateProductionRuntimeContract(env);

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining(fixture.message)]),
      );
    },
  );
});

describe("production env value formats", () => {
  it.each([
    { key: "EMAIL_FROM", value: "sales@acme.test" },
    { key: "EMAIL_FROM", value: "Acme Sales <sales@acme.test>" },
    { key: "EMAIL_FROM", value: '"Acme, Inc." <sales@acme.test>' },
    { key: "EMAIL_FROM", value: "Acmé 销售 <sales@acme.test>" },
    { key: "LOG_LEVEL", value: "info" },
    { key: "LOG_LEVEL", value: "INFO" },
    { key: "LOG_LEVEL", value: "" },
  ])("accepts $key=$value", ({ key, value }) => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      [key]: value,
    });

    expect(result.errors).toEqual([]);
  });

  it.each([
    { key: "EMAIL_FROM", value: "Acme Sales" },
    { key: "EMAIL_FROM", value: "<sales@acme.test>" },
    { key: "EMAIL_FROM", value: "Acme Sales <not-an-email>" },
    {
      key: "EMAIL_FROM",
      value: "Acme\r\nBcc: other@acme.test\r\n <sales@acme.test>",
    },
    { key: "EMAIL_FROM", value: "Acme\u0000Sales <sales@acme.test>" },
    { key: "INQUIRY_RECIPIENT_EMAIL", value: "Owner <owner@acme.test>" },
    { key: "LOG_LEVEL", value: "verbose" },
    { key: "LOG_LEVEL", value: " " },
  ])("blocks $key=$value before deploy", ({ key, value }) => {
    const result = validateProductionRuntimeContract({
      ...createValidProductionEnv(),
      [key]: value,
    });

    expect(result.errors).toEqual([expect.stringContaining(key)]);
  });
});

describe("validateProductionConfig CI vs deploy gate", () => {
  it("skips runtime contract for preview when APP_ENV=preview", () => {
    const env: NodeJS.ProcessEnv = {
      APP_ENV: "preview",
      NODE_ENV: "production",
    };

    const result = validateProductionConfig(
      env,
      createPublicLaunchInput(READY_PUBLIC_LAUNCH_FIXTURE),
    );

    expect(result.errors).toEqual([]);
    expect(result.runtimeContractChecked).toBe(false);
  });

  it("does not fail preview deploys when DEPLOYMENT_PLATFORM is not cloudflare", () => {
    const env: NodeJS.ProcessEnv = {
      APP_ENV: "preview",
      NODE_ENV: "production",
      DEPLOYMENT_PLATFORM: "development",
    };

    const result = validateProductionConfig(
      env,
      createPublicLaunchInput(READY_PUBLIC_LAUNCH_FIXTURE),
    );

    expect(result.errors).toEqual([]);
    expect(result.runtimeContractChecked).toBe(false);
  });

  it("enforces runtime contract for strict public launch checks in preview", () => {
    const env: NodeJS.ProcessEnv = {
      APP_ENV: "preview",
      NODE_ENV: "production",
      PUBLIC_LAUNCH_STRICT: "true",
    };

    const result = validateProductionConfig(
      env,
      createPublicLaunchInput(READY_PUBLIC_LAUNCH_FIXTURE),
    );

    expect(result.runtimeContractChecked).toBe(true);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Production rate limiting requires Upstash Redis",
        ),
      ]),
    );
  });

  it("keeps runtime errors as hard failures when CI=true", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      CI: "true",
    };

    const result = validateProductionConfig(env);

    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("public launch trust content guard", () => {
  it("accepts explicit owner-ready site and Wrangler fixtures", () => {
    const result = validateProductionConfig(
      {
        ...createValidProductionEnv(),
        APP_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
        NEXT_PUBLIC_SITE_URL: "https://reference-site.com",
        NEXT_PUBLIC_BASE_URL: "https://reference-site.com",
      },
      createPublicLaunchInput(READY_PUBLIC_LAUNCH_FIXTURE),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("allows a text-only site without optional company, phone, social or logo facts", () => {
    const { baseUrl, name, description, seo } =
      READY_PUBLIC_LAUNCH_FIXTURE.SINGLE_SITE_CONFIG;
    const fixture: PublicLaunchFixture = {
      SINGLE_SITE_CONFIG: {
        baseUrl,
        name,
        description,
        seo,
        contact: { email: "sales@reference-site.com" },
        social: {},
        brandAssets: { ogImage: "/opengraph-image.png", favicon: "/icon.svg" },
      },
    };
    const result = validateProductionConfig(
      {
        ...createValidProductionEnv(),
        APP_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
      },
      createPublicLaunchInput(fixture),
    );
    expect(result.errors).toEqual([]);
  });

  it("blocks supplied malformed optional facts", () => {
    const fixture: PublicLaunchFixture = {
      SINGLE_SITE_CONFIG: {
        ...READY_PUBLIC_LAUNCH_FIXTURE.SINGLE_SITE_CONFIG,
        social: { twitter: "javascript:alert(1)", linkedin: "" },
        company: {
          name: "TODO",
          established: 9999,
          location: { country: "Replace before launch" },
        },
        contact: { email: "sales@reference-site.com", phone: "call me" },
        brandAssets: {
          ogImage: "/opengraph-image.png",
          favicon: "/icon.svg",
          logo: {
            status: "ready" as const,
            horizontal: "javascript:alert(1)",
            width: 240,
            height: 72,
          },
        },
      },
    };
    const result = validateProductionConfig(
      {
        ...createValidProductionEnv(),
        APP_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
      },
      createPublicLaunchInput(fixture),
    );
    for (const field of [
      "social.twitter",
      "company.name",
      "company.established",
      "company.location.country",
      "contact.phone",
      "brandAssets.logo",
    ])
      expect(result.errors.some((error: string) => error.includes(field))).toBe(
        true,
      );
  });

  it("rejects explicit non-launch Wrangler production URLs", () => {
    const result = validateProductionConfig(
      {
        ...createValidProductionEnv(),
        APP_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
        NEXT_PUBLIC_SITE_URL: "https://reference-site.com",
        NEXT_PUBLIC_BASE_URL: "https://reference-site.com",
      },
      createPublicLaunchInput(
        READY_PUBLIC_LAUNCH_FIXTURE,
        "https://example.invalid",
      ),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "wrangler.jsonc env.production.vars.NEXT_PUBLIC_SITE_URL",
        ),
        expect.stringContaining(
          "wrangler.jsonc env.production.vars.NEXT_PUBLIC_BASE_URL",
        ),
      ]),
    );
  });

  it("reports owner-dependent public trust items as warnings by default", () => {
    const env: NodeJS.ProcessEnv = {
      APP_ENV: "preview",
      NODE_ENV: "production",
      VALIDATE_PUBLIC_LAUNCH_CONTENT: "true",
    };

    const result = validateProductionConfig(env, createPublicLaunchInput());

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SITE_CONFIG.contact.phone"),
        expect.stringContaining("brandAssets.logo.status"),
      ]),
    );
  });

  it("promotes public trust items to errors when PUBLIC_LAUNCH_STRICT=true", () => {
    const env: NodeJS.ProcessEnv = {
      APP_ENV: "preview",
      NODE_ENV: "production",
      PUBLIC_LAUNCH_STRICT: "true",
    };

    const result = validateProductionConfig(env, createPublicLaunchInput());

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SITE_CONFIG.contact.phone"),
        expect.stringContaining("brandAssets.logo.status"),
      ]),
    );
  });

  it("blocks starter identity and SEO defaults in client launch strict mode", () => {
    const result = validateProductionConfig(
      {
        APP_ENV: "preview",
        NODE_ENV: "production",
        PUBLIC_LAUNCH_STRICT: "true",
      },
      createPublicLaunchInput(),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SITE_CONFIG.name"),
        expect.stringContaining("SITE_CONFIG.baseUrl"),
        expect.stringContaining("SITE_CONFIG.contact.email"),
        expect.stringContaining("SITE_CONFIG.seo.defaultTitle"),
        expect.stringContaining("SITE_CONFIG.seo.defaultDescription"),
        expect.stringContaining("SITE_CONFIG.social.twitter"),
        expect.stringContaining("SITE_CONFIG.social.linkedin"),
        expect.stringContaining("SITE_CONFIG.seo.titleTemplate"),
        expect.stringContaining("SITE_CONFIG.description"),
        expect.stringContaining("SITE_CONFIG.company.name"),
        expect.stringContaining("SITE_CONFIG.company.location"),
      ]),
    );
  });

  it("separates template sentinel blockers from missing production readiness in the strict CLI", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/quality/checks/production-config.js"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: createChildEnv({
          APP_ENV: "production",
          NODE_ENV: "production",
          NEXT_PUBLIC_BASE_URL: "https://strict-cli.example.invalid",
          NEXT_PUBLIC_SITE_URL: "https://strict-cli.example.invalid",
          PUBLIC_LAUNCH_STRICT: "true",
        }),
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Sentinel blockers:");
    expect(result.stderr).toContain("Environment readiness blockers:");
    expect(result.stderr).toContain("SITE_CONFIG.baseUrl");
    expect(result.stderr).toContain("RATE_LIMIT_PEPPER is required");
    expect(result.stderr).toContain(
      "Production rate limiting requires Upstash Redis",
    );
  });

  it("keeps missing wrangler production vars out of sentinel classification", () => {
    expect(
      isSentinelBlocker(
        "wrangler.jsonc env.production.vars is missing; production deploy config cannot be public-launch validated.",
      ),
    ).toBe(false);
    expect(
      isSentinelBlocker(
        "wrangler.jsonc name is not public-launch ready (replace the template Worker name before production deploy).",
      ),
    ).toBe(true);
  });

  // 两个公开 URL key 各自需要一行：循环只查其中一个时，另一行会变红。
  it.each(["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_BASE_URL"])(
    "treats workers.dev and example.invalid %s values as non-launch public URLs",
    (key) => {
      const input = createPublicLaunchInput(READY_PUBLIC_LAUNCH_FIXTURE);
      const strictProductionEnv = {
        ...createValidProductionEnv(),
        APP_ENV: "production",
        NODE_ENV: "production" as const,
        PUBLIC_LAUNCH_STRICT: "true",
      };
      const workersDev = validateProductionConfig(
        {
          ...strictProductionEnv,
          [key]: "https://reference-site-preview.example.workers.dev",
        },
        input,
      );
      const exampleInvalid = validateProductionConfig(
        {
          ...strictProductionEnv,
          [key]: "https://reference-site-production.example.invalid",
        },
        input,
      );

      expect(workersDev.errors).toEqual(
        expect.arrayContaining([expect.stringContaining(key)]),
      );
      expect(exampleInvalid.errors).toEqual(
        expect.arrayContaining([expect.stringContaining(key)]),
      );
    },
  );
});
