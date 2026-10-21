// deployed-smoke 的 production 收录检查：robots.txt 与 noindex 在构建时固定，
// preview/test 构建本来就禁止抓取。漏设 APP_ENV=production 的生产构建，或
// Cloudflare Bot Preference Sync 在前面插入的屏蔽规则，都只能在这里变成失败的部署。
// 只看 robots.txt 规则，看不到只针对已验证爬虫 IP 的边缘拦截。

const PRODUCTION_INDEXING_EXPECTATIONS = [
  { pathname: "/", status: 200, indexable: true },
  { pathname: "/robots.txt", status: 200, robots: true },
];

// 搜索与 agent 爬虫必须能抓 `/`；训练爬虫（GPTBot、ClaudeBot 等）由站点 owner 决定，不在此列。
const REQUIRED_CRAWLER_TOKENS = [
  "*",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Googlebot",
  "Bingbot",
];

// RFC 9309：连续的 user-agent 行共享一组；其他记录（sitemap、content-signal）不影响分组。
function parseRobotsGroups(body) {
  const groups = [];
  let current = null;
  for (const rawLine of body.split(/\r\n|\r|\n/u)) {
    const line = rawLine.replace(/#.*/u, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      // 只取 product token：`Googlebot*`、`Googlebot/2.1` 都视同 googlebot。
      // 不做前缀匹配，ClaudeBot 不会命中 Claude-SearchBot。
      const token = value.split("/")[0].trim().replace(/\*+$/u, "");
      current.agents.push(token.toLowerCase() || "*");
    } else if (current && (key === "allow" || key === "disallow")) {
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  return groups;
}

// 空 Disallow 不匹配任何路径；`*` 匹配任意字符，末尾 `$` 锚定结尾。
function patternMatchesRoot(pattern) {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const source = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`, "u").test("/");
}

// 爬虫遵守匹配自己 token 的所有组（合并）；没有时才退回 `*` 组。
// 最长匹配规则胜出（尾部 `*` 不计入，`/*` 等同 `/`），长度相同时 allow 胜出；
// 无匹配规则即允许。
function isRootAllowedFor(groups, token) {
  const agent = token.toLowerCase();
  const own = groups.filter((group) => group.agents.includes(agent));
  const applicable =
    own.length > 0 ? own : groups.filter((group) => group.agents.includes("*"));
  let best = null;
  for (const rule of applicable.flatMap((group) => group.rules)) {
    if (!patternMatchesRoot(rule.pattern)) continue;
    const length = rule.pattern.replace(/\*+$/u, "").length;
    if (
      !best ||
      length > best.length ||
      (length === best.length && rule.allow)
    ) {
      best = { allow: rule.allow, length };
    }
  }
  return best?.allow ?? true;
}

/** 返回该探针违反的收录要求；只对带 robots/indexable 标记的 expectation 生效。 */
function findIndexingFailures(response, expectation) {
  const failures = [];
  if (expectation.robots) {
    const groups = parseRobotsGroups(response.body);
    const blocked = REQUIRED_CRAWLER_TOKENS.filter(
      (token) => !isRootAllowedFor(groups, token),
    );
    if (blocked.length > 0) {
      failures.push(
        `Expected ${response.pathname} to allow / for search and agent crawlers; disallowed for: ${blocked.join(", ")}`,
      );
    }
  }
  const { robotsTag } = response;
  if (expectation.indexable && /\b(?:noindex|none)\b/iu.test(robotsTag ?? "")) {
    failures.push(
      `Expected ${response.pathname} to be indexable, got X-Robots-Tag: ${robotsTag}`,
    );
  }
  return failures;
}

// 沿用部署工作流的 lane 信号：production 步骤设 APP_ENV=production。
function getProductionIndexingExpectations(logTag) {
  if (process.env.APP_ENV === "production") {
    return PRODUCTION_INDEXING_EXPECTATIONS;
  }
  console.log(
    `[${logTag}] Skipping robots.txt/noindex checks: APP_ENV is not production (non-production builds intentionally block crawlers).`,
  );
  return [];
}

module.exports = { findIndexingFailures, getProductionIndexingExpectations };
