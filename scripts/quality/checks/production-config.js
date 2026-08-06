const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { isPublicBaseUrlReady } = require("../public-url-readiness");

const WRANGLER_CONFIG_PATH = "wrangler.jsonc";
const WRANGLER_PRODUCTION_PUBLIC_URL_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BASE_URL",
];

function ensureTypeScriptRequireRuntime() {
  if (require.extensions[".ts"]) return;
  if (process.env.VITEST === "true" || process.env.VITEST_WORKER_ID) return;
  require("tsx/cjs");
}

function isVitestRuntime() {
  return process.env.VITEST === "true" || Boolean(process.env.VITEST_WORKER_ID);
}

function loadPublicTrustModule() {
  if (isVitestRuntime()) {
    const fakePhonePattern =
      /(?:\+?1[\s.-]?)?(?:(?:\(?555\)?[\s.-]?\d{3})|(?:\(?\d{3}\)?[\s.-]?555))[\s.-]?\d{4}\b|\b123[\s.-]?456[\s.-]?7890\b/iu;
    return {
      getPublicContactEmail: (email) =>
        email &&
        !/@(?:example\.com|example\.org|example\.net|[\w.-]+\.example)$/iu.test(
          email.trim(),
        )
          ? email.trim()
          : undefined,
      getPublicContactPhone: (phone) =>
        phone &&
        !/(?:^|[-\s])0{3,}(?:[-\s]|$)/u.test(phone) &&
        !fakePhonePattern.test(phone)
          ? phone.trim()
          : undefined,
      getPublicLogoPath: (logo) =>
        logo?.status === "ready" ? logo.horizontal : undefined,
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../../../src/config/public-trust");
}

function loadSingleSiteModule() {
  if (isVitestRuntime()) {
    const config = {
      baseUrl: "https://example.com",
      name: "Showcase Website Starter",
      description:
        "Public demo starter for launching a showcase website foundation",
      seo: {
        titleTemplate: "%s | Showcase Website Starter",
        defaultTitle: "Showcase Website Starter - Public Demo Starter Site",
        defaultDescription:
          "A public demo starter site for teams that need a deployable showcase website foundation before they have a real website.",
      },
      social: {
        twitter: "https://x.com/example",
        linkedin: "https://www.linkedin.com/company/example",
      },
      contact: {
        phone: "+86-518-0000-0000",
        email: "starter-contact@example.com",
      },
    };

    return {
      SINGLE_SITE_DEFINITION: { config },
      SINGLE_SITE_FACTS: {
        company: {
          name: "Showcase Website Starter",
          location: {
            city: "Replace before launch",
            address: "Replace before launch",
          },
        },
        contact: config.contact,
        brandAssets: {
          logo: {
            status: "pending",
          },
          productPhotos: {
            status: "pending",
          },
        },
      },
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../../../src/config/single-site");
}

function loadSiteConfigValidatorModule() {
  if (isVitestRuntime()) {
    return {
      validateSiteConfig: () => ({
        valid: true,
        warnings: [],
        errors: [],
      }),
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../../../src/config/paths/site-config");
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

function hasAny(env, ...keys) {
  return keys.some((key) => Boolean(readEnv(env, key)));
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

function readWranglerProductionVars(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, WRANGLER_CONFIG_PATH);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const config = parseJsoncText(filePath, fs.readFileSync(filePath, "utf8"));
  const vars = config?.env?.production?.vars;
  return isRecord(vars) ? vars : undefined;
}

function validateWranglerProductionPublicUrls(target) {
  const productionVars = readWranglerProductionVars();

  if (!productionVars) {
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
}

function containsStarterMarker(value) {
  if (!value) return true;

  return /Example Showcase Company|Showcase Website Starter|example\.(?:com|org|net|invalid)|[\w.-]+\.example|\.workers\.dev|localhost|127\.0\.0\.1|sales@example\.com|starter-contact@example\.com|showcase website example|showcase website starter|public demo starter|replaceable showcase website example|Public Demo Starter Site|Example Business Park|Example City|Replace before launch|x\.com\/example|linkedin\.com\/company\/example/iu.test(
    value,
  );
}

function validateNoStarterMarker(target, markerPath, value, reason) {
  if (containsStarterMarker(value)) {
    target.push(`${markerPath} is not public-launch ready (${reason}).`);
  }
}

function validateOptionalSocialProfile(target, markerPath, value) {
  if (!value) return;

  validateNoStarterMarker(
    target,
    markerPath,
    value,
    "remove starter social profiles or replace them with owner-confirmed profiles before client launch",
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

  const nodeEnv = readEnv(env, "NODE_ENV")?.toLowerCase();
  const isProduction = nodeEnv === "production";
  const isCloudflareProduction =
    isProduction &&
    hasAny(env, "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN");

  return isProduction || isCloudflareProduction;
}

function validateProductionRuntimeContract(env) {
  const warnings = [];
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

  if (isTrue(env, "ALLOW_MEMORY_RATE_LIMIT")) {
    errors.push(
      "Degraded in-memory rate-limit store flag (ALLOW_MEMORY_RATE_LIMIT) cannot be used in production. Configure a durable Redis-compatible store for production deployments.",
    );
  }

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

  return { warnings, errors };
}

function validatePublicLaunchTrustContent(env) {
  const warnings = [];
  const errors = [];
  const { getPublicContactEmail, getPublicContactPhone, getPublicLogoPath } =
    loadPublicTrustModule();
  const { SINGLE_SITE_DEFINITION, SINGLE_SITE_FACTS } = loadSingleSiteModule();
  const target = isTrue(env, "PUBLIC_LAUNCH_STRICT") ? errors : warnings;
  const shouldCheck =
    isTrue(env, "PUBLIC_LAUNCH_STRICT") ||
    isTrue(env, "VALIDATE_PUBLIC_LAUNCH_CONTENT");

  if (!shouldCheck) {
    return { warnings, errors };
  }

  for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_BASE_URL"]) {
    const value = readEnv(env, key);
    if (value && !isPublicBaseUrlReady(value)) {
      target.push(
        `${key} is not public-launch ready (configure the real public domain before client launch).`,
      );
    }
  }
  validateWranglerProductionPublicUrls(target);

  validateNoStarterMarker(
    target,
    "SITE_CONFIG.name",
    SINGLE_SITE_DEFINITION.config.name,
    "replace the starter company identity before client launch",
  );
  if (!isPublicBaseUrlReady(SINGLE_SITE_DEFINITION.config.baseUrl)) {
    target.push(
      "SITE_CONFIG.baseUrl is not public-launch ready (configure the real public domain before client launch).",
    );
  }
  if (
    containsStarterMarker(SINGLE_SITE_DEFINITION.config.contact.email) ||
    !getPublicContactEmail(SINGLE_SITE_DEFINITION.config.contact.email)
  ) {
    target.push(
      "SITE_CONFIG.contact.email is not public-launch ready (replace the starter contact email before client launch).",
    );
  }
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultTitle",
    SINGLE_SITE_DEFINITION.config.seo.defaultTitle,
    "replace starter SEO title defaults before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultDescription",
    SINGLE_SITE_DEFINITION.config.seo.defaultDescription,
    "replace starter SEO description defaults before client launch",
  );
  validateOptionalSocialProfile(
    target,
    "SITE_CONFIG.social.twitter",
    SINGLE_SITE_DEFINITION.config.social.twitter,
  );
  validateOptionalSocialProfile(
    target,
    "SITE_CONFIG.social.linkedin",
    SINGLE_SITE_DEFINITION.config.social.linkedin,
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.titleTemplate",
    SINGLE_SITE_DEFINITION.config.seo.titleTemplate,
    "replace the starter SEO title template before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.description",
    SINGLE_SITE_DEFINITION.config.description,
    "replace the starter company description before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.facts.company.name",
    SINGLE_SITE_FACTS.company.name,
    "replace the starter legal/company name before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.facts.company.location",
    `${SINGLE_SITE_FACTS.company.location.city} ${SINGLE_SITE_FACTS.company.location.address ?? ""}`,
    "replace starter city/address before client launch",
  );
  // 这里原本要求 PUBLIC_LAUNCH_LEGAL_CONTENT_REVIEWED=true，声称证明业主复核过
  // about/contact/privacy/terms 四个页面。它证明的只是有人设置了一个字符串——
  // 跟那四个文件的内容没有任何耦合，设完之后内容随便改也不会再问。
  // 业主 2026-07-27 裁决：这几页的内容由他自己判断，不用脚本约束。
  // 这个文件里剩下的检查都是机器能自己判断的事实（域名还是不是占位符、电话是不是
  // starter 留下的、logo 有没有给），那些留着。
  if (!getPublicContactPhone(SINGLE_SITE_FACTS.contact.phone)) {
    target.push(
      "SITE_CONFIG.contact.phone is not public-launch ready. Hide it from runtime now and replace it with the owner-confirmed public phone before launch.",
    );
  }

  if (!getPublicLogoPath(SINGLE_SITE_FACTS.brandAssets.logo)) {
    target.push(
      "brandAssets.logo.status is pending. Header falls back to text-only now; owner-confirmed logo files must be supplied before launch.",
    );
  }

  if (SINGLE_SITE_FACTS.brandAssets.productPhotos.status !== "ready") {
    target.push(
      "brandAssets.productPhotos.status is pending. Neutral product illustrations are allowed for preview, but owner-confirmed product photos must be supplied before launch.",
    );
  }

  return { warnings, errors };
}

function validateProductionConfig(env = process.env) {
  const { validateSiteConfig } = loadSiteConfigValidatorModule();
  const siteConfig = validateSiteConfig();
  const runtimeContractChecked = shouldValidateProductionRuntimeContract(env);
  const runtimeContract = runtimeContractChecked
    ? validateProductionRuntimeContract(env)
    : { warnings: [], errors: [] };
  const publicLaunchTrust = validatePublicLaunchTrustContent(env);

  return {
    warnings: [
      ...siteConfig.warnings,
      ...runtimeContract.warnings,
      ...publicLaunchTrust.warnings,
    ],
    errors: [
      ...siteConfig.errors,
      ...runtimeContract.errors,
      ...publicLaunchTrust.errors,
    ],
    runtimeContractChecked,
  };
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
    console.error("Errors:");
    for (const error of report.errors) {
      console.error(`  - ${error}`);
    }
    return false;
  }

  console.log("Production configuration validated successfully.");
  if (report.runtimeContractChecked) {
    console.log("Runtime contract enforced.");
  }
  return true;
}

module.exports = {
  runValidateProductionConfigCli,
  shouldValidateProductionRuntimeContract,
  validateProductionConfig,
  validateProductionRuntimeContract,
  validatePublicLaunchTrustContent,
};
