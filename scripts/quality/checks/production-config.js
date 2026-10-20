const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {
  isPlaceholderHostname,
  isPublicBaseUrlReady,
} = require("../public-url-readiness");

const WRANGLER_CONFIG_PATH = "wrangler.jsonc";
const WRANGLER_PRODUCTION_PUBLIC_URL_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BASE_URL",
];

function ensureTypeScriptRequireRuntime() {
  if (require.extensions[".ts"]) return;
  require("tsx/cjs");
}

function loadPublicLaunchInput() {
  ensureTypeScriptRequireRuntime();
  return require("../../../src/config/single-site");
}

// Node 24 原生剥离类型即可加载这个无别名、无副作用的模块，不需要 tsx。
function loadEnvFormats() {
  return require("../../../src/lib/env-formats.ts");
}

const MIN_SECRET_LENGTH = 32;

function readEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasPair(env, firstKey, secondKey) {
  return Boolean(readEnv(env, firstKey) && readEnv(env, secondKey));
}

function isTrue(env, key) {
  return readEnv(env, key) === "true";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsoncText(filePath, content) {
  const parsed = ts.parseConfigFileTextToJson(filePath, content);
  if (parsed.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"),
    );
  }
  return parsed.config;
}

function readWranglerConfig(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, WRANGLER_CONFIG_PATH);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return parseJsoncText(filePath, fs.readFileSync(filePath, "utf8"));
}

function validateWranglerProductionPublicUrls(target, wranglerConfig) {
  const productionVars = wranglerConfig?.env?.production?.vars;

  if (!isRecord(productionVars)) {
    target.push(
      "wrangler.jsonc env.production.vars is missing; production deploy config cannot be public-launch validated.",
    );
    return;
  }

  for (const key of WRANGLER_PRODUCTION_PUBLIC_URL_KEYS) {
    const value = readEnv(productionVars, key);
    if (!isPublicBaseUrlReady(value)) {
      target.push(
        `wrangler.jsonc env.production.vars.${key} is not public-launch ready (configure the real public domain before production deploy).`,
      );
    }
  }

  validateWranglerProductionTurnstileHosts(target, productionVars);
  validateEnvFormats(target, productionVars);

  const siteKey = readEnv(productionVars, "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  if (siteKey && containsStarterMarker(siteKey)) {
    target.push(
      "wrangler.jsonc env.production.vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY is not public-launch ready (replace the template Turnstile site key with the owner's widget key).",
    );
  }
}

// A non-empty TURNSTILE_ALLOWED_HOSTS replaces the site-URL fallback at runtime,
// so a stale placeholder rejects every real buyer submission as invalid-hostname.
function validateWranglerProductionTurnstileHosts(target, productionVars) {
  const configured = readEnv(productionVars, "TURNSTILE_ALLOWED_HOSTS");
  const hosts = (configured ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const siteHost = readSiteHostname(
    readEnv(productionVars, "NEXT_PUBLIC_SITE_URL"),
  );
  const isReady =
    hosts.length > 0 &&
    hosts.every((host) => isPublicBaseUrlReady(`https://${host}`)) &&
    (!siteHost || hosts.includes(siteHost));

  if (!isReady) {
    target.push(
      "wrangler.jsonc env.production.vars.TURNSTILE_ALLOWED_HOSTS is not public-launch ready (list the real site hostname from NEXT_PUBLIC_SITE_URL and no placeholder or local hosts before production deploy).",
    );
  }
}

function readSiteHostname(siteUrl) {
  try {
    return new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function containsStarterMarker(value) {
  if (!value) return true;

  return /Northstar Industrial Reference|B2B Inquiry Template|b2b-inquiry-site-base|0x4AAAAAADvC8KDbJ54402pb|inquiry site reference|referencia (?:neutral )?para consultas B2B|Plantilla de consultas B2B|no destinado a producción|(?:Privacy policy|Terms) — to be completed|Incomplete placeholder|(?:Privacidad|Condiciones) — pendientes? de completar|Texto provisional incompleto|Sustituye este texto provisional|Example Showcase Company|Showcase Website Starter|example\.(?:com|org|net|invalid)|[\w.-]+\.example|\.workers\.dev|localhost|127\.0\.0\.1|sales@example\.(?:com|invalid)|starter-contact@example\.com|non-production B2B inquiry reference|sentinel identity|showcase website example|showcase website starter|public demo starter|replaceable showcase website example|Public Demo Starter Site|Example Business Park|Example City|Replace before launch|This privacy policy is incomplete|These terms are incomplete|Esta política de privacidad está incompleta|Estas condiciones están incompletas|Replace this placeholder|Replace with owner-confirmed|x\.com\/example|linkedin\.com\/company\/example/iu.test(
    value,
  );
}

// 站点身份的唯一占位判断：运行时只读显式字段、留空不展示，
// 格式在 SINGLE_SITE_CONFIG 加载时校验，已填写的占位值只能在这里被拦下。
function isPlaceholderFact(value) {
  return (
    containsStarterMarker(value) ||
    !value.trim() ||
    /(?:^|[\s[(])TODO(?:$|[\s:\]_-])/u.test(value) ||
    /placeholder/iu.test(value)
  );
}

function isPublicEmailReady(email) {
  if (typeof email !== "string") return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return false;
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return !isPlaceholderFact(email) && !isPlaceholderHostname(domain);
}

const PHONE_ZERO_BLOCK_PATTERN = /(?:^|[-\s])0{3,}(?:[-\s]|$)/u;
const US_COUNTRY_CODE_WITH_NATIONAL_LENGTH = 11;
const US_NATIONAL_PHONE_LENGTH = 10;
const US_AREA_CODE_END = 3;
const US_EXCHANGE_CODE_END = 6;

function isFakePublicPhoneNumber(phone) {
  const digits = phone.replace(/\D/gu, "");
  const nationalDigits =
    digits.length === US_COUNTRY_CODE_WITH_NATIONAL_LENGTH &&
    digits.startsWith("1")
      ? digits.slice(1)
      : digits;

  if (nationalDigits === "1234567890") return true;
  if (nationalDigits.length !== US_NATIONAL_PHONE_LENGTH) return false;

  return (
    nationalDigits.slice(0, US_AREA_CODE_END) === "555" ||
    nationalDigits.slice(US_AREA_CODE_END, US_EXCHANGE_CODE_END) === "555"
  );
}

function isPublicPhoneReady(phone) {
  if (typeof phone !== "string") return false;
  if (!/^\+?[\d ()-]{7,25}$/u.test(phone)) return false;
  if (!/^[1-9]\d{6,14}$/u.test(phone.replace(/\D/gu, ""))) return false;
  return (
    !PHONE_ZERO_BLOCK_PATTERN.test(phone) && !isFakePublicPhoneNumber(phone)
  );
}

function isFoundingYearReady(year) {
  return (
    Number.isInteger(year) && year > 0 && year <= new Date().getUTCFullYear()
  );
}

// 运行时原样输出 horizontal：必须是同源的本地路径且尺寸有效。
function isPublicLogoReady(logo, baseUrl) {
  if (logo.status !== "ready") return false;
  if (
    !Number.isInteger(logo.width) ||
    logo.width <= 0 ||
    !Number.isInteger(logo.height) ||
    logo.height <= 0
  )
    return false;
  if (!/^\/(?!\/)[^\s\\]+$/u.test(logo.horizontal)) return false;
  try {
    const base = new URL(baseUrl);
    return new URL(logo.horizontal, base).origin === base.origin;
  } catch {
    return false;
  }
}

// 运行时原样写进 sameAs：首尾空白也算不合格。
function isPublicSocialUrlReady(value) {
  if (value !== value.trim() || isPlaceholderFact(value)) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hostname.includes(".") &&
      !isPlaceholderHostname(hostname)
    );
  } catch {
    return false;
  }
}

function validateNoStarterMarker(target, markerPath, value, reason) {
  if (containsStarterMarker(value)) {
    target.push(`${markerPath} is not public-launch ready (${reason}).`);
  }
}

const SECURITY_TXT_PATH = "public/.well-known/security.txt";
// 纯文本文件会原样上线（或在本地 release 构建时生效），逐行扫模板占位。
const PLACEHOLDER_TEXT_FILES = [".env.production", SECURITY_TXT_PATH];
// 页面模块和 messages 只扫实际导出的字符串：注释不会发布，也就不会影响结果。
const PLACEHOLDER_VALUE_DIRS = ["messages/base", "src/content/pages"];

function pushPlaceholderError(target, location) {
  target.push(
    `${location} is not public-launch ready (replace template placeholder content before client launch).`,
  );
}

function validatePlaceholderTextFile(target, rootDir, file) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || (file === ".env.production" && trimmed.startsWith("#"))) {
      return;
    }
    if (containsStarterMarker(line)) {
      pushPlaceholderError(target, `${file}:${index + 1}`);
    }
  });

  // RFC 9116 要求 Expires；过期的 security.txt 等于没有。
  const expires = /^Expires:\s*(.+)$/imu.exec(content)?.[1];
  if (file === SECURITY_TXT_PATH && !(Date.parse(expires) > Date.now())) {
    target.push(
      `${file} Expires is not public-launch ready (set a future expiry date).`,
    );
  }
}

function listPlaceholderValueFiles(rootDir) {
  const files = [];
  for (const dir of PLACEHOLDER_VALUE_DIRS) {
    const absDir = path.join(rootDir, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir, { recursive: true })) {
      if (/\.(?:json|ts)$/u.test(entry)) files.push(path.join(dir, entry));
    }
  }
  return files;
}

// CLI 已由 loadPublicLaunchInput 注册 tsx（支持 @/ 别名）；否则靠 Node 原生剥离类型加载。
function loadPublishedValues(rootDir, file) {
  const filePath = path.join(rootDir, file);
  if (file.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  // eslint-disable-next-line security/detect-non-literal-require -- 路径来自本仓库内容目录的列举，加载后只读导出值
  return require(filePath);
}

function scanPublishedValues(target, file, value, keyPath) {
  if (typeof value === "string") {
    // 空字符串是合法的"不展示"，不是占位。
    if (value && containsStarterMarker(value)) {
      pushPlaceholderError(target, `${file} ${keyPath.join(".")}`);
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      scanPublishedValues(target, file, child, [...keyPath, key]);
    }
  }
}

function validateTemplatePlaceholderFiles(target, rootDir) {
  for (const file of PLACEHOLDER_TEXT_FILES) {
    validatePlaceholderTextFile(target, rootDir, file);
  }
  for (const file of listPlaceholderValueFiles(rootDir)) {
    let values;
    try {
      values = loadPublishedValues(rootDir, file);
    } catch (error) {
      // 读不出就无法证明没有占位：按未就绪处理。
      target.push(
        `${file} is not public-launch ready (could not load it to check published text: ${String(error?.message ?? error).split("\n")[0]}).`,
      );
      continue;
    }
    scanPublishedValues(target, file, values, []);
  }
}

function validateWranglerSentinelResources(target, config) {
  if (!config) return;

  validateNoStarterMarker(
    target,
    "wrangler.jsonc name",
    config.name,
    "replace the template Worker name before production deploy",
  );
}

function validateRequiredEnv(target, env, key, reason) {
  if (!readEnv(env, key)) {
    target.push(`${key} is required (${reason}).`);
  }
}

function validateMinLengthEnv(target, env, key, minLength, reason) {
  const value = readEnv(env, key);
  if (!value) {
    target.push(`${key} is required (${reason}).`);
  } else if (value.length < minLength) {
    target.push(
      `${key} must be at least ${minLength} characters long (${reason}). Current length: ${value.length}`,
    );
  }
}

// 与运行时 env schema 同一规则：坏格式会让 env 模块加载即抛错，询盘全部 500。
// 运行时 emptyStringAsUndefined：空字符串视为未设置，纯空白仍交给 schema 拒绝。
function validateEnvFormats(target, env) {
  const { emailAddressSchema, emailSenderSchema, logLevelSchema } =
    loadEnvFormats();
  for (const [key, schema, expected] of [
    ["EMAIL_FROM", emailSenderSchema, 'an email address or "Name <address>"'],
    ["INQUIRY_RECIPIENT_EMAIL", emailAddressSchema, "a bare email address"],
    ["LOG_LEVEL", logLevelSchema, "error, warn, info or debug"],
  ]) {
    const value = env[key];
    if (
      typeof value === "string" &&
      value !== "" &&
      !schema.safeParse(value).success
    ) {
      target.push(
        `${key} has an invalid format (expected ${expected}); the runtime env module would throw and every inquiry would fail.`,
      );
    }
  }
}

function shouldValidateProductionRuntimeContract(env) {
  if (isTrue(env, "PUBLIC_LAUNCH_STRICT")) {
    return true;
  }

  const appEnv = readEnv(env, "APP_ENV")?.toLowerCase();

  if (appEnv === "preview") {
    return false;
  }

  if (appEnv === "production") {
    return true;
  }

  return readEnv(env, "NODE_ENV")?.toLowerCase() === "production";
}

function validateProductionRuntimeContract(env) {
  const errors = [];
  const hasUpstash = hasPair(
    env,
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  );

  if (!hasUpstash) {
    errors.push(
      "Production rate limiting requires Upstash Redis. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  validateMinLengthEnv(
    errors,
    env,
    "RATE_LIMIT_PEPPER",
    MIN_SECRET_LENGTH,
    "production rate-limit keys rely on it and runtime already throws when it is missing or weak",
  );

  validateRequiredEnv(
    errors,
    env,
    "TURNSTILE_SECRET_KEY",
    "the live inquiry form always renders Turnstile and server verification depends on the secret key",
  );
  validateRequiredEnv(
    errors,
    env,
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "the live inquiry form always renders Turnstile and the public widget depends on a site key",
  );

  validateRequiredEnv(
    errors,
    env,
    "EMAIL_FROM",
    "the shipped lead pipeline needs an explicitly authorized sender address",
  );
  validateRequiredEnv(
    errors,
    env,
    "INQUIRY_RECIPIENT_EMAIL",
    "the shipped lead pipeline needs an explicit owner inbox for inquiry notifications",
  );
  validateRequiredEnv(
    errors,
    env,
    "RESEND_API_KEY",
    "the shipped lead pipeline sends admin notification email through Resend",
  );
  validateRequiredEnv(
    errors,
    env,
    "AIRTABLE_API_KEY",
    "the shipped lead pipeline persists lead records in Airtable",
  );
  validateRequiredEnv(
    errors,
    env,
    "AIRTABLE_BASE_ID",
    "the shipped lead pipeline persists lead records in Airtable",
  );

  validateEnvFormats(errors, env);

  if (isTrue(env, "NEXT_PUBLIC_TEST_MODE")) {
    errors.push("NEXT_PUBLIC_TEST_MODE=true is forbidden in production.");
  }

  if (readEnv(env, "SECURITY_HEADERS_ENABLED")?.toLowerCase() === "false") {
    errors.push("SECURITY_HEADERS_ENABLED=false is forbidden in production.");
  }

  if (readEnv(env, "NEXT_PUBLIC_SECURITY_MODE")?.toLowerCase() === "relaxed") {
    errors.push(
      "NEXT_PUBLIC_SECURITY_MODE=relaxed is forbidden in production.",
    );
  }

  if (readEnv(env, "DEPLOYMENT_PLATFORM") !== "cloudflare") {
    errors.push(
      'DEPLOYMENT_PLATFORM must be "cloudflare" for production Cloudflare deployments (set the canonical platform signal in wrangler env.production.vars).',
    );
  }

  return { errors };
}

function validateOptionalPublicFacts(target, config) {
  const { company, contact, brandAssets } = config;
  if (company) {
    if (isPlaceholderFact(company.name)) {
      target.push(
        "SITE_CONFIG.company.name is not public-launch ready (supply a real company name or omit the company).",
      );
    }
    if (
      company.established !== undefined &&
      !isFoundingYearReady(company.established)
    ) {
      target.push(
        "SITE_CONFIG.company.established is not public-launch ready.",
      );
    }
    for (const [key, value] of Object.entries(company.location ?? {})) {
      if (value && isPlaceholderFact(value)) {
        target.push(
          `SITE_CONFIG.company.location.${key} is not public-launch ready.`,
        );
      }
    }
  }
  // 可选事实可以省略；已填写的占位或无效值不能获得上线许可。
  // 法律正文由业主判断，不用审核布尔值代替内容复核。
  if (contact.phone && !isPublicPhoneReady(contact.phone)) {
    target.push(
      "SITE_CONFIG.contact.phone is not public-launch ready. Remove it or supply a valid public phone.",
    );
  }
  if (
    brandAssets.logo &&
    !isPublicLogoReady(brandAssets.logo, config.baseUrl)
  ) {
    target.push(
      "brandAssets.logo.status is pending or invalid. Remove it for a text-only brand or supply a ready logo with a local path and dimensions.",
    );
  }
}

function validatePublicLaunchTrustContent(env, input) {
  const warnings = [];
  const errors = [];
  const target = isTrue(env, "PUBLIC_LAUNCH_STRICT") ? errors : warnings;
  const shouldCheck =
    isTrue(env, "PUBLIC_LAUNCH_STRICT") ||
    isTrue(env, "VALIDATE_PUBLIC_LAUNCH_CONTENT");

  if (!shouldCheck) {
    return { warnings, errors };
  }

  const { SINGLE_SITE_CONFIG } = input?.publicLaunch ?? loadPublicLaunchInput();
  const rootDir = input?.rootDir ?? process.cwd();

  for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_BASE_URL"]) {
    const value = readEnv(env, key);
    if (value && !isPublicBaseUrlReady(value)) {
      target.push(
        `${key} is not public-launch ready (configure the real public domain before client launch).`,
      );
    }
  }
  const wranglerConfig = readWranglerConfig(rootDir);
  validateWranglerProductionPublicUrls(target, wranglerConfig);
  validateWranglerSentinelResources(target, wranglerConfig);
  validateTemplatePlaceholderFiles(target, rootDir);

  validateNoStarterMarker(
    target,
    "SITE_CONFIG.name",
    SINGLE_SITE_CONFIG.name,
    "replace the starter company identity before client launch",
  );
  if (!isPublicBaseUrlReady(SINGLE_SITE_CONFIG.baseUrl)) {
    target.push(
      "SITE_CONFIG.baseUrl is not public-launch ready (configure the real public domain before client launch).",
    );
  }
  if (!isPublicEmailReady(SINGLE_SITE_CONFIG.contact.email)) {
    target.push(
      "SITE_CONFIG.contact.email is not public-launch ready (replace the starter contact email before client launch).",
    );
  }
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultTitle",
    SINGLE_SITE_CONFIG.seo.defaultTitle,
    "replace starter SEO title defaults before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultDescription",
    SINGLE_SITE_CONFIG.seo.defaultDescription,
    "replace starter SEO description defaults before client launch",
  );
  for (const [key, value] of Object.entries(SINGLE_SITE_CONFIG.social)) {
    if (value && !isPublicSocialUrlReady(value)) {
      target.push(
        `SITE_CONFIG.social.${key} is not public-launch ready (remove or supply a valid public profile URL).`,
      );
    }
  }
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.titleTemplate",
    SINGLE_SITE_CONFIG.seo.titleTemplate,
    "replace the starter SEO title template before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.description",
    SINGLE_SITE_CONFIG.description,
    "replace the starter company description before client launch",
  );
  validateOptionalPublicFacts(target, SINGLE_SITE_CONFIG);

  return { warnings, errors };
}

function validateProductionConfig(env = process.env, input) {
  const runtimeContractChecked = shouldValidateProductionRuntimeContract(env);
  const runtimeContract = runtimeContractChecked
    ? validateProductionRuntimeContract(env)
    : { errors: [] };
  const publicLaunchTrust = validatePublicLaunchTrustContent(env, input);

  return {
    warnings: publicLaunchTrust.warnings,
    errors: [...runtimeContract.errors, ...publicLaunchTrust.errors],
    runtimeContractChecked,
  };
}

function isSentinelBlocker(message) {
  return (
    message.includes("is not public-launch ready") ||
    message.includes("SITE_CONFIG.") ||
    message.includes("brandAssets.")
  );
}

function printErrors(title, errors) {
  if (errors.length === 0) return;

  console.error(`${title}:`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
}

function runValidateProductionConfigCli() {
  const report = validateProductionConfig(process.env);

  if (report.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of report.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (report.errors.length > 0) {
    const sentinelBlockers = report.errors.filter(isSentinelBlocker);
    const environmentReadinessBlockers = report.errors.filter(
      (error) => !isSentinelBlocker(error),
    );

    printErrors("Sentinel blockers", sentinelBlockers);
    printErrors("Environment readiness blockers", environmentReadinessBlockers);
    return false;
  }

  console.log("Production configuration validated successfully.");
  if (report.runtimeContractChecked) {
    console.log("Runtime contract enforced.");
  }
  return true;
}

if (require.main === module) {
  if (!runValidateProductionConfigCli()) process.exitCode = 1;
}

module.exports = {
  isSentinelBlocker,
  readWranglerConfig,
  shouldValidateProductionRuntimeContract,
  validateProductionConfig,
  validateProductionRuntimeContract,
};
