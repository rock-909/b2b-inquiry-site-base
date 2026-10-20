import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { READY_PUBLIC_LAUNCH_FIXTURE } from "./production-config-fixtures";
import {
  isSentinelBlocker,
  validateProductionConfig,
} from "../../../scripts/quality/checks/production-config.js";

const FIXTURE_PREFIX = "b2b-inquiry-placeholders-";

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
  };
}

// 其余上线信息全部就绪，只变动被扫描的文件，失败必定来自占位扫描。
function createReadyInput() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 写入本测试刚创建的临时目录
  writeFileSync(
    path.join(rootDir, "wrangler.jsonc"),
    JSON.stringify({
      name: "reference-site",
      env: {
        production: {
          vars: {
            NEXT_PUBLIC_SITE_URL: "https://reference-site.com",
            NEXT_PUBLIC_BASE_URL: "https://reference-site.com",
            TURNSTILE_ALLOWED_HOSTS: "reference-site.com",
          },
        },
      },
    }),
  );
  return { rootDir, publicLaunch: READY_PUBLIC_LAUNCH_FIXTURE };
}

describe("template placeholder files", () => {
  const strictEnv = {
    ...createValidProductionEnv(),
    APP_ENV: "production",
    PUBLIC_LAUNCH_STRICT: "true",
  };
  const readyFiles: Record<string, string> = {
    "messages/base/en/messages.json": JSON.stringify(
      { home: { metadata: { description: "Valves made to order." } } },
      null,
      2,
    ),
    "messages/base/es/messages.json": JSON.stringify(
      { home: { metadata: { description: "Válvulas a medida." } } },
      null,
      2,
    ),
    "src/content/pages/en/privacy.ts":
      'export const page = { title: "Privacy policy", content: "We keep inquiries for 24 months." };\n',
    "src/content/pages/es/terms.ts":
      'export const page = { title: "Términos", content: "Condiciones de uso del sitio." };\n',
    "public/.well-known/security.txt":
      "Contact: mailto:security@acme-industrial.com\nExpires: 2999-01-01T00:00:00.000Z\n",
    ".env.production":
      "NEXT_PUBLIC_SITE_URL=https://acme-industrial.com\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAOwnerSiteKey\n",
  };

  function inputWithFiles(overrides: Record<string, string> = {}) {
    const input = createReadyInput();
    for (const [file, content] of Object.entries({
      ...readyFiles,
      ...overrides,
    })) {
      const filePath = path.join(input.rootDir, file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 写入本测试刚创建的临时目录
      mkdirSync(path.dirname(filePath), { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上
      writeFileSync(filePath, content);
    }
    return input;
  }

  it("passes owner-ready messages, legal pages, security.txt and .env.production", () => {
    const result = validateProductionConfig(strictEnv, inputWithFiles());

    expect(result.errors).toEqual([]);
  });

  it("accepts an https security.txt Contact", () => {
    const result = validateProductionConfig(
      strictEnv,
      inputWithFiles({
        "public/.well-known/security.txt":
          "Contact: https://acme-industrial.com/security\nExpires: 2999-01-01T00:00:00.000Z\n",
      }),
    );

    expect(result.errors).toEqual([]);
  });

  // 只拦模板占位本身：正常条款里的相同短语、不会输出的注释都不能阻断上线。
  it.each([
    {
      file: "src/content/pages/en/terms.ts",
      content:
        'export const page = { content: "Payment is to be completed within 30 days of invoice." };',
    },
    {
      file: "src/content/pages/es/terms.ts",
      content:
        'export const page = { content: "Los pedidos pendientes de completar se facturan a fin de mes." };',
    },
    {
      file: "src/content/pages/en/terms.ts",
      content:
        '// Previous template title: Terms — to be completed\nexport const page = { title: "Terms" };',
    },
    {
      file: "src/content/pages/en/terms.ts",
      content:
        '/**\n * Previous template title: Terms — to be completed\n */\nexport default { content: "Payment is due within 30 days." };',
    },
    {
      file: "src/content/pages/en/terms.ts",
      content:
        'export default { content: "Payment is due within 30 days." }; // Previous template title: Terms — to be completed',
    },
    {
      file: ".env.production",
      content:
        "# Was https://example.invalid before launch\nNEXT_PUBLIC_SITE_URL=https://acme-industrial.com\n",
    },
  ])("passes owner text in $file: $content", ({ file, content }) => {
    const result = validateProductionConfig(
      strictEnv,
      inputWithFiles({ [file]: content }),
    );

    expect(result.errors).toEqual([]);
  });

  it.each([
    {
      file: "messages/base/en/messages.json",
      content:
        '{ "description": "A non-production B2B inquiry reference site." }',
    },
    {
      file: "messages/base/es/messages.json",
      content: '{ "title": "{siteName} - Plantilla de consultas B2B" }',
    },
    {
      file: "src/content/pages/en/privacy.ts",
      content:
        'export const page = { title: "Privacy policy — to be completed" };',
    },
    {
      file: "src/content/pages/en/terms.ts",
      content:
        'export default {\n/* Legal title */ title: "Terms — to be completed",\ncontent: "Payment is due within 30 days." };',
    },
    {
      file: "src/content/pages/en/terms.ts",
      content: "export default { title: ",
    },
    {
      file: "src/content/pages/en/terms.ts",
      content:
        'export const page = { title: "Terms of sale", content: `\nThese terms are incomplete. Replace this placeholder with real terms.\n` };',
    },
    {
      file: "src/content/pages/en/privacy.ts",
      content:
        'export const page = { title: "Privacy policy", content: `\nThis privacy policy is incomplete.\n` };',
    },
    {
      file: "src/content/pages/es/terms.ts",
      content:
        'export const page = { description: "Texto provisional incompleto." };',
    },
    {
      file: "src/content/pages/es/terms.ts",
      content:
        'export const page = { title: "Condiciones — pendientes de completar" };',
    },
    {
      file: "src/content/pages/es/terms.ts",
      content:
        'export const page = { title: "Condiciones", content: `\nEstas condiciones están incompletas.\n` };',
    },
    {
      file: "src/content/pages/es/privacy.ts",
      content:
        'export const page = { title: "Privacidad", content: `\nEsta política de privacidad está incompleta.\n` };',
    },
    {
      file: "public/.well-known/security.txt",
      content:
        "Contact: mailto:security@example.invalid\nExpires: 2999-01-01T00:00:00.000Z\n",
    },
    {
      file: "public/.well-known/security.txt",
      content:
        "Contact: mailto:security@acme-industrial.com\nExpires: 2001-01-01T00:00:00.000Z\n",
    },
    {
      file: "public/.well-known/security.txt",
      content: "Contact: mailto:security@acme-industrial.com\n",
    },
    // RFC 9116 要求至少一个可用的 Contact；保留域名同样联系不上。
    {
      file: "public/.well-known/security.txt",
      content: "Expires: 2999-01-01T00:00:00.000Z\n",
    },
    {
      file: "public/.well-known/security.txt",
      content:
        "Contact: http://acme-industrial.com/security\nExpires: 2999-01-01T00:00:00.000Z\n",
    },
    {
      file: "public/.well-known/security.txt",
      content:
        "Contact: mailto:security@acme-industrial.test\nExpires: 2999-01-01T00:00:00.000Z\n",
    },
    {
      file: ".env.production",
      content: "NEXT_PUBLIC_SITE_URL=https://example.invalid\n",
    },
    {
      file: ".env.production",
      content: "NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAADvC8KDbJ54402pb\n",
    },
  ])(
    "blocks a template placeholder in $file: $content",
    ({ file, content }) => {
      const result = validateProductionConfig(
        strictEnv,
        inputWithFiles({ [file]: content }),
      );

      expect(result.errors).toEqual([expect.stringContaining(file)]);
      expect(result.errors.every(isSentinelBlocker)).toBe(true);
    },
  );

  // 门禁进程的 NODE_ENV 由 workflow 固定为 production，Worker 真正拿到的是这里的 vars。
  it.each([
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0x4AAAAAADvC8KDbJ54402pb"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA"],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "3x00000000000000000000FF"],
    ["TURNSTILE_SECRET_KEY", "2x0000000000000000000000000000000AA"],
    ["NODE_ENV", "development"],
    ["NODE_ENV", "test"],
    ["TURNSTILE_BYPASS", "true"],
  ])("blocks %s=%s in wrangler production vars", (key, value) => {
    const input = inputWithFiles();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 写入本测试刚创建的临时目录
    writeFileSync(
      path.join(input.rootDir, "wrangler.jsonc"),
      JSON.stringify({
        name: "reference-site",
        env: {
          production: {
            vars: {
              NEXT_PUBLIC_SITE_URL: "https://reference-site.com",
              NEXT_PUBLIC_BASE_URL: "https://reference-site.com",
              TURNSTILE_ALLOWED_HOSTS: "reference-site.com",
              [key]: value,
            },
          },
        },
      }),
    );

    const result = validateProductionConfig(strictEnv, input);

    expect(result.errors).toEqual([
      expect.stringContaining(`env.production.vars.${key}`),
    ]);
  });

  it.each(["verbose", " "])(
    "blocks LOG_LEVEL=%j in wrangler production vars",
    (logLevel) => {
      const input = inputWithFiles();
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 写入本测试刚创建的临时目录
      writeFileSync(
        path.join(input.rootDir, "wrangler.jsonc"),
        JSON.stringify({
          name: "reference-site",
          env: {
            production: {
              vars: {
                NEXT_PUBLIC_SITE_URL: "https://reference-site.com",
                NEXT_PUBLIC_BASE_URL: "https://reference-site.com",
                TURNSTILE_ALLOWED_HOSTS: "reference-site.com",
                LOG_LEVEL: logLevel,
              },
            },
          },
        }),
      );

      const result = validateProductionConfig(strictEnv, input);

      expect(result.errors).toEqual([expect.stringContaining("LOG_LEVEL")]);
    },
  );
});
