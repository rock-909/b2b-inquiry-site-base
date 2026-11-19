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

// 指令按逗号分项整项匹配，`max-image-preview: none` 不算禁止收录。
// 只有 X-Robots-Tag 可带 `googlebot:` 前缀；HTML meta 由 name 指定爬虫。
const HTML_BLOCKING_DIRECTIVE = /^(?:noindex|none)$/iu;
const HEADER_BLOCKING_DIRECTIVE =
  /^(?:(?!max-image-preview\s*:)[^:]+:)?\s*(?:noindex|none)$/iu;

function hasBlockingDirective(value, directive) {
  return value.split(",").some((item) => directive.test(item.trim()));
}

const NAMED_CHARACTER_REFERENCES = {
  colon: ":",
  comma: ",",
  NewLine: "\n",
  Tab: "\t",
};

function decodeAttributeValue(value) {
  return value.replace(
    /&(?:#(\d+);?|#[xX]([\da-fA-F]+);?|([A-Za-z]+);)/gu,
    (reference, decimal, hex, name) => {
      if (decimal || hex) {
        const codePoint = Number.parseInt(decimal ?? hex, decimal ? 10 : 16);
        return codePoint > 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : "\ufffd";
      }
      return Object.hasOwn(NAMED_CHARACTER_REFERENCES, name)
        ? NAMED_CHARACTER_REFERENCES[name]
        : reference;
    },
  );
}

function findBlockingRobotsMeta(html) {
  // 部署后的冒烟步骤没有 node_modules。跳过注释、原始文本、未实例化的 template 和属性值中的标签示例。
  const tags =
    /<!--[\s\S]*?(?:-->|$)|<(script|style|title|textarea)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/\1\s*>|$)|<(\/?)([a-z][\w:-]*)(?=[\s/>])((?:[^"'<>]|"[^"]*"|'[^']*')*)>/giu;
  const attributes =
    /([^\s=/"'<>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>]+))?/gu;
  let templateDepth = 0;
  for (const [, , closing, tagName, source] of html.matchAll(tags)) {
    const tag = tagName?.toLowerCase();
    if (tag === "template") {
      templateDepth = closing
        ? Math.max(0, templateDepth - 1)
        : templateDepth + 1;
      continue;
    }
    if (templateDepth > 0 || closing || tag !== "meta") continue;

    const values = new Map();
    for (const [, name, value = ""] of source.matchAll(attributes)) {
      const key = name.toLowerCase();
      if (!values.has(key)) {
        values.set(
          key,
          decodeAttributeValue(value.replace(/^["']|["']$/gu, "")),
        );
      }
    }
    const content = values.get("content");
    if (
      values.get("name")?.toLowerCase() === "robots" &&
      hasBlockingDirective(content ?? "", HTML_BLOCKING_DIRECTIVE)
    ) {
      return content;
    }
  }
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
  if (expectation.indexable) {
    const { robotsTag, body } = response;
    if (hasBlockingDirective(robotsTag ?? "", HEADER_BLOCKING_DIRECTIVE)) {
      failures.push(
        `Expected ${response.pathname} to be indexable, got X-Robots-Tag: ${robotsTag}`,
      );
    }
    const robotsMeta = findBlockingRobotsMeta(body ?? "");
    if (robotsMeta !== undefined) {
      failures.push(
        `Expected ${response.pathname} to be indexable, got robots meta content: ${robotsMeta}`,
      );
    }
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
