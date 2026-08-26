const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  OFFERINGS,
  getOfferingById,
  getOfferingPath,
} = require("../../../src/config/offerings.ts");

const ROOT = process.cwd();

const DEFAULT_CF_PREVIEW_BASE_URL =
  process.env.CLOUDFLARE_PREVIEW_BASE_URL || "http://127.0.0.1:8787";
const DEFAULT_DEPLOY_SMOKE_BASE_URL = process.env.DEPLOY_SMOKE_BASE_URL || "";
const DEFAULT_EXTERNAL_URL_SMOKE_BASE_URL = DEFAULT_DEPLOY_SMOKE_BASE_URL;
const DEPLOY_SMOKE_REQUEST_TIMEOUT_MS = 30000;
const DEPLOY_SMOKE_REQUEST_RETRIES = 2;
const DEPLOY_SMOKE_RETRY_DELAY_MS = 1000;
const MIN_HTML_BODY_LENGTH = 1024;
const SMOKE_OFFERING = OFFERINGS[0];
const MISSING_OFFERING_ID = "__smoke-missing-offering__";

if (!SMOKE_OFFERING) {
  throw new Error("Cloudflare smoke requires at least one configured offering");
}
if (getOfferingById(MISSING_OFFERING_ID)) {
  throw new Error(`${MISSING_OFFERING_ID} must remain an unknown offering id`);
}

const SMOKE_OFFERING_PATH = getOfferingPath(SMOKE_OFFERING.id);
const MISSING_OFFERING_PATH = getOfferingPath(MISSING_OFFERING_ID);
const CORE_PUBLIC_PAGE_PATHS = [
  "/",
  "/products",
  SMOKE_OFFERING_PATH,
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];
const EXTERNAL_URL_SMOKE_EXPECTATIONS = CORE_PUBLIC_PAGE_PATHS.map(
  (pathname) => ({ pathname, status: 200 }),
);
const CF_PREVIEW_SMOKE_EXPECTATIONS = [
  ...CORE_PUBLIC_PAGE_PATHS.map((pathname) => ({
    pathname,
    status: 200,
    html: true,
  })),
  { pathname: MISSING_OFFERING_PATH, status: 404, html: true },
];
const DEPLOYED_SMOKE_EXPECTATIONS = [
  ...CF_PREVIEW_SMOKE_EXPECTATIONS,
  { pathname: "/api/health", status: 200 },
  { pathname: "/.well-known/security.txt", status: 200 },
  { pathname: "/security-policy.txt", status: 404 },
];
const CF_PREVIEW_PROOF_OUTPUT_PATH = path.join(
  ROOT,
  "reports",
  "deploy",
  "cloudflare-preview-proof.json",
);
const CF_PREVIEW_DEPLOY_COMMAND = [
  "exec",
  "opennextjs-cloudflare",
  "deploy",
  "--env",
  "preview",
];
const CF_PREVIEW_URL_PATTERN = new RegExp(
  "https://[^\\s\\\"']+\\.workers\\.dev",
  "gi",
);
const CF_PREVIEW_DEPLOY_URL_PATTERN = CF_PREVIEW_URL_PATTERN;

// ---------------------------------------------------------------------------
// 统一的表驱动参数解析：mode 只声明自己的选项表，解析循环只有一份。
// ---------------------------------------------------------------------------

function valueOption(key) {
  return { key, takesValue: true };
}

function flagOption(key) {
  return { key };
}

function parseSmokeArgs(args, optionSpecs, initial) {
  const parsed = { ...initial };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    const spec = optionSpecs[arg];
    // 与原实现一致：未知参数与"缺值"场景共用同一错误合同。
    if (!spec) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (!spec.takesValue) {
      parsed[spec.key] = true;
      continue;
    }

    if (i + 1 >= args.length) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    parsed[spec.key] = args[++i];
  }

  return parsed;
}

const COMMON_BASE_URL_OPTION = "--base-url";

function parseCloudflarePreviewSmokeArgs(args) {
  const parsed = parseSmokeArgs(
    args,
    {
      [COMMON_BASE_URL_OPTION]: valueOption("baseUrl"),
      "--include-api-health": flagOption("includeApiHealth"),
      "--rounds": valueOption("rounds"),
    },
    {
      baseUrl: DEFAULT_CF_PREVIEW_BASE_URL,
      includeApiHealth: false,
      rounds: 1,
    },
  );

  parsed.rounds = Number(parsed.rounds);
  if (!Number.isInteger(parsed.rounds) || parsed.rounds < 1) {
    throw new Error("--rounds must be a positive integer");
  }

  return parsed;
}

function parseExternalUrlSmokeArgs(args) {
  const parsed = parseSmokeArgs(
    args,
    { [COMMON_BASE_URL_OPTION]: valueOption("baseUrl") },
    { baseUrl: DEFAULT_EXTERNAL_URL_SMOKE_BASE_URL },
  );

  if (!parsed.baseUrl) {
    throw new Error("Missing required --base-url");
  }

  return parsed;
}

function parseDeployedSmokeArgs(args) {
  const parsed = parseSmokeArgs(
    args,
    {
      [COMMON_BASE_URL_OPTION]: valueOption("baseUrl"),
      "--header-name": valueOption("headerName"),
      "--header-value": valueOption("headerValue"),
    },
    {
      baseUrl: DEFAULT_DEPLOY_SMOKE_BASE_URL,
      headerName: process.env.DEPLOY_SMOKE_HEADER_NAME || "",
      headerValue: process.env.DEPLOY_SMOKE_HEADER_VALUE || "",
    },
  );

  if (!parsed.baseUrl) {
    throw new Error("Missing required --base-url");
  }

  if (Boolean(parsed.headerName) !== Boolean(parsed.headerValue)) {
    throw new Error(
      "Both --header-name and --header-value must be provided together",
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// 统一的探针：一份请求/采集实现，重试策略与附加 header 由调用方给出。
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(attempt) {
  return DEPLOY_SMOKE_RETRY_DELAY_MS * 2 ** attempt;
}

function isRetriableFetchError(error) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }

  return (
    error instanceof Error &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    error.cause.code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

function collectProbeFields(pathname, response, body, retries) {
  return {
    pathname,
    status: response.status,
    location: response.headers.get("location"),
    leakedMiddlewareCookie: response.headers.get("x-middleware-set-cookie"),
    robotsTag: response.headers.get("x-robots-tag"),
    contentType: response.headers.get("content-type"),
    frameOptions: response.headers.get("x-frame-options"),
    nosniff: response.headers.get("x-content-type-options"),
    referrerPolicy: response.headers.get("referrer-policy"),
    csp: response.headers.get("content-security-policy"),
    body,
    ...(retries !== undefined ? { retries } : {}),
  };
}

/**
 * 单条路由探测。所有 smoke lane 共用这一份 fetch/text/超时/重试实现；
 * 无重试需求的 lane 传 retries=0（默认），行为与旧版完全一致。
 */
async function probePathname(
  baseUrl,
  pathname,
  { userAgent, extraHeaders = {}, retries = 0, logTag, retryEvents = [] } = {},
) {
  const url = new URL(pathname, baseUrl);
  const headers = { "user-agent": userAgent, ...extraHeaders };

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(DEPLOY_SMOKE_REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();

      if (response.status >= 500 && attempt < retries) {
        attempt += 1;
        retryEvents.push({
          pathname,
          reason: `status ${response.status}`,
          nextAttempt: attempt + 1,
        });
        console.warn(
          `[${logTag}] ${pathname} returned ${response.status}; retrying attempt ${attempt + 1}/${retries + 1}`,
        );
        await delay(getRetryDelayMs(attempt - 1));
        continue;
      }

      return collectProbeFields(pathname, response, body, retries);
    } catch (error) {
      lastError = error;
      // 不可重试的错误原样冒泡；无重试预算的 lane 同样立即冒泡。
      if (!isRetriableFetchError(error) || attempt >= retries) {
        if (retries > 0) {
          // deployed lane 的既有错误合同：包装为统一的 retry-loop 失败。
          const wrapped = new Error(
            "post-deploy-smoke retry loop exited without a response",
          );
          wrapped.cause = error;
          throw wrapped;
        }
        throw error;
      }

      attempt += 1;
      retryEvents.push({
        pathname,
        reason: error instanceof Error ? error.message : String(error),
        nextAttempt: attempt + 1,
      });
      console.warn(
        `[${logTag}] ${pathname} request failed; retrying attempt ${attempt + 1}/${retries + 1}`,
      );
      await delay(getRetryDelayMs(attempt - 1));
    }
  }
}

// ---------------------------------------------------------------------------
// 统一的评估器：按 lane 能力开关逐项核对，失败消息与旧实现逐字一致。
// ---------------------------------------------------------------------------

function pushFailureUnless(condition, message, failures) {
  if (!condition && !failures.includes(message)) failures.push(message);
}

function pushExpectedStatus(response, expectedStatus, failures) {
  pushFailureUnless(
    response.status === expectedStatus,
    `Expected ${response.pathname} to return ${expectedStatus}, got ${response.status}`,
    failures,
  );
}

// F-05：安全 header 必须真的到达浏览器——配置存在不等于生效，
// 部署管线（CDN/Worker/静态资产分流）任何一环丢失都只能在这里发现。
function pushSecurityHeaderChecks(response, failures) {
  const headerChecks = [
    ["x-frame-options", response.frameOptions, "DENY"],
    ["x-content-type-options", response.nosniff, "nosniff"],
    [
      "referrer-policy",
      response.referrerPolicy,
      "strict-origin-when-cross-origin",
    ],
  ];

  for (const [headerName, actual, expected] of headerChecks) {
    pushFailureUnless(
      (actual ?? "").toLowerCase().includes(expected.toLowerCase()),
      `Expected ${response.pathname} to carry ${headerName}: ${expected}, got ${actual ?? "none"}`,
      failures,
    );
  }

  pushFailureUnless(
    typeof response.csp === "string" && response.csp.length > 0,
    `Expected ${response.pathname} to carry a non-empty content-security-policy`,
    failures,
  );
}

function pushHealthyHtmlResponse(response, failures) {
  pushFailureUnless(
    response.contentType?.startsWith("text/html"),
    `Expected ${response.pathname} to return HTML, got ${response.contentType ?? "no content-type"}`,
    failures,
  );
  pushFailureUnless(
    response.body.length >= MIN_HTML_BODY_LENGTH,
    `Expected ${response.pathname} HTML body to be at least ${MIN_HTML_BODY_LENGTH} bytes, got ${response.body.length}`,
    failures,
  );
  pushFailureUnless(
    /<\/html>\s*$/iu.test(response.body),
    `Expected ${response.pathname} to return a complete HTML document`,
    failures,
  );
  pushFailureUnless(
    !response.body.includes("Unexpected loadManifest"),
    `Unexpected manifest loader failure surfaced on ${response.pathname}`,
    failures,
  );
  pushFailureUnless(
    !response.body.includes("Application error"),
    `Unexpected application error surfaced on ${response.pathname}`,
    failures,
  );
}

function pushBodyErrorChecks(response, failures) {
  pushFailureUnless(
    !response.body.includes("Unexpected loadManifest"),
    `Unexpected manifest loader failure surfaced on ${response.pathname}`,
    failures,
  );
  pushFailureUnless(
    !response.body.includes("Application error"),
    `Unexpected application error surfaced on ${response.pathname}`,
    failures,
  );
}

function pushRobotsTagCheck(response, expectation, failures) {
  if (!expectation.robotsTag) return;
  pushFailureUnless(
    (response.robotsTag ?? "").includes(expectation.robotsTag),
    `Expected ${response.pathname} to carry X-Robots-Tag: ${expectation.robotsTag}, got ${response.robotsTag ?? "none"}`,
    failures,
  );
}

function pushLeakedMiddlewareCookieCheck(response, failures) {
  pushFailureUnless(
    response.leakedMiddlewareCookie === null,
    `Unexpected x-middleware-set-cookie leak on ${response.pathname}`,
    failures,
  );
}

/**
 * 按 lane 能力开关评估单条探针结果。html=true 时隐含 body 错误检查，
 * 与旧实现的检查集合完全一致；bodyErrors 显式开启供 external lane 使用。
 */
function evaluateProbe(
  response,
  expectation,
  {
    htmlChecks = false,
    leakedCookieCheck = false,
    bodyErrorChecks = false,
  } = {},
  failures = [],
) {
  pushExpectedStatus(response, expectation.status, failures);
  pushRobotsTagCheck(response, expectation, failures);

  if (expectation.html && htmlChecks) {
    pushHealthyHtmlResponse(response, failures);
    pushSecurityHeaderChecks(response, failures);
  }

  if (leakedCookieCheck) {
    pushLeakedMiddlewareCookieCheck(response, failures);
  }

  if (bodyErrorChecks) {
    pushBodyErrorChecks(response, failures);
  }

  return failures;
}

/** 并发探测一轮 expectation 列表。 */
async function probeRound(expectations, probe) {
  return Promise.all(expectations.map(({ pathname }) => probe(pathname)));
}

function printFailures(logTag, failures) {
  console.error(`[${logTag}] Failures detected:`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
}

// ---------------------------------------------------------------------------
// Lane runners：薄壳，只负责自己的日志、特殊流程与 plan 组装。
// ---------------------------------------------------------------------------

const EXTERNAL_URL_SMOKE_LOG_TAG = "external-url-smoke";
const CF_PREVIEW_SMOKE_LOG_TAG = "cf-preview-smoke";
const POST_DEPLOY_SMOKE_LOG_TAG = "post-deploy-smoke";

async function runExternalUrlSmoke(args = []) {
  const { baseUrl } = parseExternalUrlSmokeArgs(args);

  console.log(
    `[${EXTERNAL_URL_SMOKE_LOG_TAG}] Probing external URL surface ${baseUrl}`,
  );
  console.log(
    `[${EXTERNAL_URL_SMOKE_LOG_TAG}] Policy: this checks the supplied URL only; it does not prove the current SHA, artifact, or deploy.`,
  );

  const failures = [];
  for (const expectation of EXTERNAL_URL_SMOKE_EXPECTATIONS) {
    const response = await probePathname(baseUrl, expectation.pathname, {
      userAgent: EXTERNAL_URL_SMOKE_LOG_TAG,
    });
    evaluateProbe(response, expectation, { bodyErrorChecks: true }, failures);
  }

  if (failures.length > 0) {
    printFailures(EXTERNAL_URL_SMOKE_LOG_TAG, failures);
    return false;
  }

  console.log(`[${EXTERNAL_URL_SMOKE_LOG_TAG}] All checks passed`);
  return true;
}

async function runCloudflarePreviewSmoke(args = []) {
  const { baseUrl, includeApiHealth, rounds } =
    parseCloudflarePreviewSmokeArgs(args);
  const expectations = [
    ...CF_PREVIEW_SMOKE_EXPECTATIONS,
    ...(includeApiHealth ? [{ pathname: "/api/health", status: 200 }] : []),
  ];

  console.log(
    `[${CF_PREVIEW_SMOKE_LOG_TAG}] Probing ${baseUrl} (${includeApiHealth ? "strict" : "page"} mode)`,
  );

  const failures = [];
  const responses = [];
  for (let round = 0; round < rounds; round++) {
    responses.push(
      ...(await probeRound(expectations, (pathname) =>
        probePathname(baseUrl, pathname, {
          userAgent: CF_PREVIEW_SMOKE_LOG_TAG,
        }),
      )),
    );
  }

  // 与旧实现一致：middleware cookie 泄漏先于其余检查整体输出。
  for (const response of responses) {
    pushLeakedMiddlewareCookieCheck(response, failures);
  }
  for (const [index, response] of responses.entries()) {
    const expectation = expectations[index % expectations.length];
    evaluateProbe(response, expectation, { htmlChecks: true }, failures);
  }

  if (!includeApiHealth) {
    console.log(
      "[cf-preview-smoke] Skipping /api/health (diagnostic-only in local preview).",
    );
    console.log(
      "[cf-preview-smoke] Policy: local preview proves page/cookie behavior. API proof belongs to deployed smoke.",
    );
  }

  if (failures.length > 0) {
    printFailures(CF_PREVIEW_SMOKE_LOG_TAG, failures);
    return false;
  }

  console.log(`[${CF_PREVIEW_SMOKE_LOG_TAG}] All checks passed`);
  return true;
}

function buildDeployedSmokeHeaders(headerName, headerValue) {
  const headers = {
    "user-agent": POST_DEPLOY_SMOKE_LOG_TAG,
  };

  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }

  return headers;
}

async function runDeployedSmoke(args = []) {
  const { baseUrl, headerName, headerValue } = parseDeployedSmokeArgs(args);
  // buildDeployedSmokeHeaders 携带的默认 UA 与探针一致；自定义 proof header
  // 通过展开传入，若显式覆盖 user-agent 也与旧实现一样生效。
  const extraHeaders = buildDeployedSmokeHeaders(headerName, headerValue);
  const failures = [];
  const retryEvents = [];

  console.log(`[${POST_DEPLOY_SMOKE_LOG_TAG}] Probing ${baseUrl}`);
  console.log(
    "[post-deploy-smoke] Scope: deployed routes only; DNS, TLS, and custom-domain confirmation stay manual.",
  );

  // One concurrent round so every mandatory route is probed together; per-route
  // retry state stays local inside probePathname.
  const responses = await probeRound(DEPLOYED_SMOKE_EXPECTATIONS, (pathname) =>
    probePathname(baseUrl, pathname, {
      userAgent: POST_DEPLOY_SMOKE_LOG_TAG,
      extraHeaders,
      retries: DEPLOY_SMOKE_REQUEST_RETRIES,
      logTag: POST_DEPLOY_SMOKE_LOG_TAG,
      retryEvents,
    }),
  );

  for (const [index, response] of responses.entries()) {
    const expectation = DEPLOYED_SMOKE_EXPECTATIONS[index];
    evaluateProbe(
      response,
      expectation,
      { htmlChecks: true, leakedCookieCheck: true },
      failures,
    );
  }

  if (failures.length > 0) {
    printFailures(POST_DEPLOY_SMOKE_LOG_TAG, failures);
    return false;
  }

  if (retryEvents.length > 0) {
    console.warn("[post-deploy-smoke] Retried probes:");
    for (const retry of retryEvents) {
      console.warn(
        `  - ${retry.pathname}: ${retry.reason}; next attempt ${retry.nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
      );
    }
  }

  console.log(`[${POST_DEPLOY_SMOKE_LOG_TAG}] All checks passed`);
  return true;
}

// ---------------------------------------------------------------------------
// Preview deploy proof adapter：编排部署与已部署冒烟，产出结构化 proof。
// ---------------------------------------------------------------------------

function runChildCommand(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function extractCloudflarePreviewDeploymentUrls(output) {
  const urls = [];
  for (const match of output.matchAll(CF_PREVIEW_DEPLOY_URL_PATTERN)) {
    urls.push({
      worker: "native",
      url: match[0] ?? "",
    });
  }
  if (urls.length > 0) return urls;

  return [...new Set(output.match(CF_PREVIEW_URL_PATTERN) ?? [])].map(
    (url) => ({
      worker: "unknown",
      url,
    }),
  );
}

function chooseCloudflarePreviewGatewayUrl(urls) {
  const explicitGateway = urls.find((item) => item.worker === "native");
  if (explicitGateway) return explicitGateway.url;
  return urls.at(-1)?.url ?? null;
}

function writeCloudflarePreviewProofResult(result) {
  fs.mkdirSync(path.dirname(CF_PREVIEW_PROOF_OUTPUT_PATH), {
    recursive: true,
  });
  fs.writeFileSync(
    CF_PREVIEW_PROOF_OUTPUT_PATH,
    JSON.stringify(result, null, 2),
  );
}

function printCloudflarePreviewProofOutput(label, result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(
    `[proof:cf:preview-deployed] ${label} exit=${result.status ?? 1}`,
  );
}

async function runCloudflarePreviewDeployedProof() {
  const deployResult = runChildCommand("pnpm", CF_PREVIEW_DEPLOY_COMMAND);
  const deployOutput = `${deployResult.stdout ?? ""}\n${deployResult.stderr ?? ""}`;
  printCloudflarePreviewProofOutput("deploy", deployResult);
  const deployCommand = `pnpm ${CF_PREVIEW_DEPLOY_COMMAND.join(" ")}`;

  if (/MISSING_MESSAGE/iu.test(deployOutput)) {
    const result = {
      status: "fail",
      stage: "deploy-log",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason: "next-intl MISSING_MESSAGE detected during preview proof",
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  if (deployResult.status !== 0) {
    const result = {
      status: "blocked",
      stage: "deploy",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason: "preview deploy failed or credentials are unavailable",
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 2;
  }

  const urls = extractCloudflarePreviewDeploymentUrls(deployOutput);
  const baseUrl = chooseCloudflarePreviewGatewayUrl(urls);

  if (!baseUrl) {
    const result = {
      status: "blocked",
      stage: "deploy-output-parse",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason:
        "preview deploy completed but no workers.dev URL was found in output",
      discoveredUrls: urls,
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 2;
  }

  // Proof adapter 保持与旧实现一致的子进程边界：deployed-smoke 以独立进程
  // 运行，崩溃域隔离且 CLI/proof JSON 语义 100% 不变；这是审计建议中
  // "可控 fixture/subprocess 验证"的最强形式。
  const smokeArgs = [
    "scripts/quality/checks/cloudflare-smoke.js",
    "deployed-smoke",
    "--base-url",
    baseUrl,
  ];
  const smokeResult = runChildCommand("node", smokeArgs);
  printCloudflarePreviewProofOutput("smoke", smokeResult);

  const result = {
    status: smokeResult.status === 0 ? "pass" : "fail",
    stage: smokeResult.status === 0 ? "complete" : "smoke",
    generatedAt: new Date().toISOString(),
    baseUrl,
    discoveredUrls: urls,
    deployCommand,
    smokeCommand: `node ${smokeArgs.join(" ")}`,
  };
  writeCloudflarePreviewProofResult(result);
  console.log(JSON.stringify(result, null, 2));

  return smokeResult.status ?? 1;
}

async function main([command, ...args] = process.argv.slice(2)) {
  const handlers = {
    "cf-preview-smoke": runCloudflarePreviewSmoke,
    "external-url-smoke": runExternalUrlSmoke,
    "deployed-smoke": runDeployedSmoke,
    "cf-preview-deployed": runCloudflarePreviewDeployedProof,
  };
  const handler = handlers[command];

  if (!handler) {
    console.error(
      "Usage: node scripts/quality/checks/cloudflare-smoke.js <cf-preview-smoke|external-url-smoke|deployed-smoke|cf-preview-deployed> [options]",
    );
    return 1;
  }

  const result = await handler(args);
  return typeof result === "number" ? result : result ? 0 : 1;
}

if (require.main === module) {
  main().then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      console.error("[cloudflare-smoke] Unexpected error:", error);
      process.exitCode = 1;
    },
  );
}

module.exports = {
  runCloudflarePreviewDeployedProof,
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
  runExternalUrlSmoke,
};
