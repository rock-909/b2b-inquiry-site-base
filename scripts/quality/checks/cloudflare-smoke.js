const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const DEFAULT_CF_PREVIEW_BASE_URL =
  process.env.CLOUDFLARE_PREVIEW_BASE_URL || "http://127.0.0.1:8787";
const DEFAULT_DEPLOY_SMOKE_BASE_URL = process.env.DEPLOY_SMOKE_BASE_URL || "";
const DEFAULT_EXTERNAL_URL_SMOKE_BASE_URL = DEFAULT_DEPLOY_SMOKE_BASE_URL;
const DEPLOY_SMOKE_REQUEST_TIMEOUT_MS = 30000;
const DEPLOY_SMOKE_REQUEST_RETRIES = 2;
const DEPLOY_SMOKE_RETRY_DELAY_MS = 1000;
const MIN_HTML_BODY_LENGTH = 1024;
const PRODUCTS_PAGE_SEGMENT = "/$d$locale/products/__PAGE__";
const EXTERNAL_URL_SMOKE_EXPECTATIONS = [
  { pathname: "/", status: 200 },
  { pathname: "/products", status: 200 },
  { pathname: "/contact", status: 200 },
  { pathname: "/request-quote", status: 200 },
  { pathname: "/zh", status: 404 },
  { pathname: "/zh/contact", status: 404 },
];
const CF_PREVIEW_SMOKE_EXPECTATIONS = [
  { pathname: "/", status: 200, html: true },
  { pathname: "/invalid/contact", status: 404, html: true },
  { pathname: "/products", status: 200, html: true },
  { pathname: "/contact", status: 200, html: true },
  { pathname: "/request-quote", status: 200, html: true },
  { pathname: "/zh", status: 404 },
  { pathname: "/zh/contact", status: 404 },
  // public/ 下的文件由 Cloudflare Static Assets 直送，不经过 Next 服务器，
  // 所以 Node 侧的 e2e 证明不了它们的响应头。这里打的是本地 Worker，
  // 是 public/_headers 唯一的行为层证明。
  {
    pathname: "/downloads/spec-sheet-tb-bw.pdf",
    status: 200,
    robotsTag: "noindex",
  },
];
const DEPLOYED_SMOKE_EXPECTATIONS = [
  { pathname: "/", status: 200 },
  { pathname: "/invalid/contact", status: 404 },
  { pathname: "/products", status: 200 },
  { pathname: "/contact", status: 200 },
  { pathname: "/request-quote", status: 200 },
  { pathname: "/api/health", status: 200 },
  { pathname: "/zh", status: 404 },
  { pathname: "/zh/contact", status: 404 },
  { pathname: "/.well-known/security.txt", status: 200 },
  { pathname: "/security-policy.txt", status: 404 },
  {
    pathname: "/downloads/spec-sheet-tb-bw.pdf",
    status: 200,
    robotsTag: "noindex",
  },
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

function parseCloudflarePreviewSmokeArgs(args) {
  const parsed = {
    baseUrl: DEFAULT_CF_PREVIEW_BASE_URL,
    includeApiHealth: false,
    rounds: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    if (arg === "--base-url" && i + 1 < args.length) {
      parsed.baseUrl = args[++i];
      continue;
    }

    if (arg === "--include-api-health") {
      parsed.includeApiHealth = true;
      continue;
    }

    if (arg === "--rounds" && i + 1 < args.length) {
      parsed.rounds = Number(args[++i]);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(parsed.rounds) || parsed.rounds < 1) {
    throw new Error("--rounds must be a positive integer");
  }

  return parsed;
}

async function requestCloudflarePreviewSmoke(
  baseUrl,
  pathname,
  headers = {},
  redirect = "manual",
) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect,
    headers: {
      "user-agent": "cloudflare-preview-smoke",
      ...headers,
    },
    signal: AbortSignal.timeout(DEPLOY_SMOKE_REQUEST_TIMEOUT_MS),
  });

  return {
    pathname,
    status: response.status,
    location: response.headers.get("location"),
    setCookie: response.headers.get("set-cookie"),
    leakedMiddlewareCookie: response.headers.get("x-middleware-set-cookie"),
    robotsTag: response.headers.get("x-robots-tag"),
    contentType: response.headers.get("content-type"),
    nextCache: response.headers.get("x-nextjs-cache"),
    nextPostponed: response.headers.get("x-nextjs-postponed"),
    body: await response.text(),
  };
}

async function requestSmokeRound(expectations, request) {
  return Promise.all(expectations.map(({ pathname }) => request(pathname)));
}

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

function pushHealthyRscResponse(response, label, marker, failures) {
  pushExpectedStatus(response, 200, failures);
  pushFailureUnless(
    response.contentType?.startsWith("text/x-component"),
    `Expected /products ${label} to return text/x-component, got ${response.contentType ?? "no content-type"}`,
    failures,
  );
  pushFailureUnless(
    response.body.length >= 24 &&
      response.body.includes(marker) &&
      !/<(?:!doctype|html)/iu.test(response.body),
    `Expected /products ${label} to return a non-truncated Flight payload, not HTML`,
    failures,
  );
}

function parseExternalUrlSmokeArgs(args) {
  const parsed = {
    baseUrl: DEFAULT_EXTERNAL_URL_SMOKE_BASE_URL,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    if (arg === "--base-url" && i + 1 < args.length) {
      parsed.baseUrl = args[++i];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.baseUrl) {
    throw new Error("Missing required --base-url");
  }

  return parsed;
}

async function requestExternalUrlSmoke(baseUrl, pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "external-url-smoke",
    },
    signal: AbortSignal.timeout(DEPLOY_SMOKE_REQUEST_TIMEOUT_MS),
  });

  return {
    pathname,
    status: response.status,
    body: await response.text(),
  };
}

async function runExternalUrlSmoke(args = []) {
  const { baseUrl } = parseExternalUrlSmokeArgs(args);
  const failures = [];

  console.log(`[external-url-smoke] Probing external URL surface ${baseUrl}`);
  console.log(
    "[external-url-smoke] Policy: this checks the supplied URL only; it does not prove the current SHA, artifact, or deploy.",
  );

  const responses = [];
  for (const { pathname } of EXTERNAL_URL_SMOKE_EXPECTATIONS) {
    responses.push(await requestExternalUrlSmoke(baseUrl, pathname));
  }

  for (const [index, response] of responses.entries()) {
    pushExpectedStatus(
      response,
      EXTERNAL_URL_SMOKE_EXPECTATIONS[index].status,
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

  if (failures.length > 0) {
    console.error("[external-url-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    return false;
  }

  console.log("[external-url-smoke] All checks passed");
  return true;
}

// eslint-disable-next-line max-statements -- one ordered runtime proof; splitting it would hide request order.
async function runCloudflarePreviewSmoke(args = []) {
  const { baseUrl, includeApiHealth, rounds } =
    parseCloudflarePreviewSmokeArgs(args);
  const failures = [];
  const expectations = [
    ...CF_PREVIEW_SMOKE_EXPECTATIONS,
    ...(includeApiHealth ? [{ pathname: "/api/health", status: 200 }] : []),
  ];

  console.log(
    `[cf-preview-smoke] Probing ${baseUrl} (${includeApiHealth ? "strict" : "page/header"} mode)`,
  );

  const responses = [];
  for (let round = 0; round < rounds; round++) {
    responses.push(
      ...(await requestSmokeRound(expectations, (pathname) =>
        requestCloudflarePreviewSmoke(baseUrl, pathname),
      )),
    );
  }

  // Re-check sequentially after the concurrent rounds so a damaged isolate or
  // incremental cache cannot hide behind successful in-flight responses.
  const productsWarmResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/products",
  );
  const productsCachedResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/products",
  );
  const productsRscResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/products",
    { rsc: "1", "next-router-prefetch": "1" },
    "follow",
  );
  const productsRouteTreeResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/products",
    {
      rsc: "1",
      "next-router-prefetch": "1",
      "next-router-segment-prefetch": "/_tree",
    },
    "follow",
  );
  const productsPageSegmentResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/products",
    {
      rsc: "1",
      "next-router-prefetch": "1",
      "next-router-segment-prefetch": PRODUCTS_PAGE_SEGMENT,
    },
    "follow",
  );

  for (const response of [
    ...responses,
    productsWarmResponse,
    productsCachedResponse,
    productsRscResponse,
    productsRouteTreeResponse,
    productsPageSegmentResponse,
  ]) {
    pushFailureUnless(
      response.leakedMiddlewareCookie === null,
      `Unexpected x-middleware-set-cookie leak on ${response.pathname}`,
      failures,
    );
  }

  for (const [index, response] of responses.entries()) {
    const expectation = expectations[index % expectations.length];
    pushExpectedStatus(response, expectation.status, failures);
    if (expectation.robotsTag) {
      pushFailureUnless(
        (response.robotsTag ?? "").includes(expectation.robotsTag),
        `Expected ${response.pathname} to carry X-Robots-Tag: ${expectation.robotsTag}, got ${response.robotsTag ?? "none"}`,
        failures,
      );
    }
    if (expectation.html) {
      pushHealthyHtmlResponse(response, failures);
    }
  }

  pushHealthyHtmlResponse(productsWarmResponse, failures);
  pushHealthyHtmlResponse(productsCachedResponse, failures);
  pushFailureUnless(
    productsCachedResponse.nextCache === "HIT",
    `Expected warmed /products to return X-Nextjs-Cache: HIT, got ${productsCachedResponse.nextCache ?? "none"}`,
    failures,
  );
  pushHealthyRscResponse(
    productsRscResponse,
    "RSC probe",
    '"$Sreact.fragment"',
    failures,
  );
  pushHealthyRscResponse(
    productsRouteTreeResponse,
    "route-tree prefetch",
    '"tree"',
    failures,
  );
  pushHealthyRscResponse(
    productsPageSegmentResponse,
    "page-segment prefetch",
    '"$Sreact.fragment"',
    failures,
  );
  for (const [label, response] of [
    ["route-tree prefetch", productsRouteTreeResponse],
    ["page-segment prefetch", productsPageSegmentResponse],
  ]) {
    pushFailureUnless(
      response.nextPostponed === "2",
      `Expected /products ${label} to return X-Nextjs-Postponed: 2, got ${response.nextPostponed ?? "none"}`,
      failures,
    );
    pushFailureUnless(
      response.nextCache === "HIT",
      `Expected /products ${label} to return X-Nextjs-Cache: HIT, got ${response.nextCache ?? "none"}`,
      failures,
    );
  }

  if (!includeApiHealth) {
    console.log(
      "[cf-preview-smoke] Skipping /api/health (diagnostic-only in local preview).",
    );
    console.log(
      "[cf-preview-smoke] Policy: local preview proves page/header/cookie behavior. API proof belongs to deployed smoke.",
    );
  }

  if (failures.length > 0) {
    console.error("[cf-preview-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    return false;
  }

  console.log("[cf-preview-smoke] All checks passed");
  return true;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDeploySmokeRetryDelayMs(attempt) {
  return DEPLOY_SMOKE_RETRY_DELAY_MS * 2 ** attempt;
}

function parseDeployedSmokeArgs(args) {
  const parsed = {
    baseUrl: DEFAULT_DEPLOY_SMOKE_BASE_URL,
    headerName: process.env.DEPLOY_SMOKE_HEADER_NAME || "",
    headerValue: process.env.DEPLOY_SMOKE_HEADER_VALUE || "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    if (arg === "--base-url" && i + 1 < args.length) {
      parsed.baseUrl = args[++i];
      continue;
    }

    if (arg === "--header-name" && i + 1 < args.length) {
      parsed.headerName = args[++i];
      continue;
    }

    if (arg === "--header-value" && i + 1 < args.length) {
      parsed.headerValue = args[++i];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

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

function buildDeployedSmokeHeaders(headerName, headerValue) {
  const headers = {
    "user-agent": "post-deploy-smoke",
  };

  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }

  return headers;
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

async function requestDeployedSmoke(baseUrl, pathname, headers, retryEvents) {
  const url = new URL(pathname, baseUrl);

  let retries = 0;
  let lastError;

  for (let attempt = 0; attempt <= DEPLOY_SMOKE_REQUEST_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(DEPLOY_SMOKE_REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();

      if (response.status >= 500 && attempt < DEPLOY_SMOKE_REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: `status ${response.status}`,
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} returned ${response.status}; retrying attempt ${nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
        );
        await delay(getDeploySmokeRetryDelayMs(attempt));
        continue;
      }

      return {
        pathname,
        status: response.status,
        location: response.headers.get("location"),
        leakedMiddlewareCookie: response.headers.get("x-middleware-set-cookie"),
        robotsTag: response.headers.get("x-robots-tag"),
        body,
        retries,
      };
    } catch (error) {
      lastError = error;
      if (!isRetriableFetchError(error)) throw error;

      if (attempt < DEPLOY_SMOKE_REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: error instanceof Error ? error.message : String(error),
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} request failed; retrying attempt ${nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
        );
        await delay(getDeploySmokeRetryDelayMs(attempt));
      }
    }
  }

  throw new Error("post-deploy-smoke retry loop exited without a response", {
    cause: lastError,
  });
}

async function runDeployedSmoke(args = []) {
  const { baseUrl, headerName, headerValue } = parseDeployedSmokeArgs(args);
  const headers = buildDeployedSmokeHeaders(headerName, headerValue);
  const failures = [];
  const retryEvents = [];

  console.log(`[post-deploy-smoke] Probing ${baseUrl}`);

  // One concurrent round so every mandatory route is probed together; per-route
  // retry state stays local inside requestDeployedSmoke.
  const responses = await requestSmokeRound(
    DEPLOYED_SMOKE_EXPECTATIONS,
    (pathname) => requestDeployedSmoke(baseUrl, pathname, headers, retryEvents),
  );

  for (const [index, response] of responses.entries()) {
    const expectation = DEPLOYED_SMOKE_EXPECTATIONS[index];
    pushExpectedStatus(response, expectation.status, failures);
    if (expectation.robotsTag) {
      pushFailureUnless(
        (response.robotsTag ?? "").includes(expectation.robotsTag),
        `Expected ${response.pathname} to carry X-Robots-Tag: ${expectation.robotsTag}, got ${response.robotsTag ?? "none"}`,
        failures,
      );
    }
    pushFailureUnless(
      response.leakedMiddlewareCookie === null,
      `Unexpected x-middleware-set-cookie leak on ${response.pathname}`,
      failures,
    );
  }

  if (failures.length > 0) {
    console.error("[post-deploy-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
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

  console.log("[post-deploy-smoke] All checks passed");
  return true;
}

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

function runCloudflarePreviewDeployedProof() {
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

  const smokeArgs = [
    "scripts/starter-checks.js",
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

module.exports = {
  runCloudflarePreviewDeployedProof,
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
  runExternalUrlSmoke,
};
