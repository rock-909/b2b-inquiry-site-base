/* ------------------------------------------------------------------ *
 * wrangler 4.100.0 解析并套用 `_headers` 的那套语义，移植过来的一份。
 *
 * 单独一个文件，是因为它不认识 downloads、不认识 `_next/static`、不碰磁盘，只回答
 * 「wrangler 拿到这份 `_headers`，会怎么解析、哪条规则命中哪条路径、最终那个头是
 * 什么值」。哪些文件必须带 noindex、哪些必须带一年缓存，那是仓库自己的政策，全在
 * cloudflare-static-asset-headers.js 里。
 *
 * 两边混在一个文件里过，结果是每次改政策都要在移植的代码里翻半天，而移植的代码
 * 一旦被顺手「改进」，对齐的就不是 wrangler 了。
 *
 * 文件里两类东西，改法完全不同：
 *
 * 一、**照抄的，别按「这样写更好」改**。判据是注释里有 cli.js 行号：`escapeRegex`、
 * `extractPathname`、`validateRulePath`、`hasInvalidWildcards`、`isValidRule`、
 * `parseWranglerHeaderRules`、`compileRulePattern`、`ruleToMatcher`、
 * `toMatchTarget`、`listPlaceholderNames`、`replacePlaceholders`，以及它们用到的
 * 常量。前三轮审查的每一个缺陷都是同一个根因：凭理解近似 wrangler 的语义，近似一
 * 次就漏一处。逐条打补丁只会一直漏下去——占位符正则、路径归一化、非法规则、行长
 * 上限、规则条数上限，每一条都能单独造出一个假绿。所以这里不再近似，直接照抄锁定
 * 版本的实现，来源标在每个常量后面（行号是 node_modules/wrangler/wrangler-dist/cli.js）。
 *
 * wrangler 的 parser 不能直接 import：它被打进了 cli.js 这个 bundle，
 * `@cloudflare/workers-shared` 和 miniflare 都取不到这个模块。移植是唯一的路。
 *
 * 二、**这份门禁自己定的，可以改，但改了要自己重新论证**。wrangler 从不解析头值，
 * 所以「怎么比一个头值算不算达到期望」没有原件可抄：`normalizeHeaderValue`、
 * `toDirectiveSet`、`expandDirectives` 和 robots 那两张表（依据是 Google 的
 * `X-Robots-Tag` 文档，不是 wrangler）、`hasUnbalancedQuotes` 和
 * `splitOutsideQuotes`（HTTP quoted-string，通用语法）、`parseExpectedHeader`
 * （解析门禁自己写的期望串）、`resolveEffectiveHeaders`（依据是实测，见它自己的
 * 注释）、`listHeaderScopes` 和 `toHostname`（「按域名分场景」是这份门禁发明的模型）。
 * ------------------------------------------------------------------ */

// constants.ts（cli.js:128966-128973）
const MAX_LINE_LENGTH = 2000;
const MAX_HEADER_RULES = 100;
const HEADER_SEPARATOR = ":";
const UNSET_OPERATOR = "! ";
const SPLAT_PATTERN = /\*/gu;
// 这一条是 rules-engine.ts 的 `PLACEHOLDER_REGEX2`（cli.js:336438），**不是**
// constants.ts 的 `PLACEHOLDER_REGEX`（cli.js:128973）。两者只差一个捕获组，而
// `listPlaceholderNames` 和 `compileRulePattern` 都靠 `match[1]` 取名字：照
// constants.ts 那个抄一遍，拿到的占位符名全是 undefined。
const NAMED_PLACEHOLDER_PATTERN = /:([A-Za-z]\w*)/gu;

// parseHeaders.ts（cli.js:129214）
const LINE_IS_PROBABLY_A_PATH = /^([^\s]+:\/\/|^\/)/u;

// validateURL.ts（cli.js:128995-128996）
const URL_REGEX = /^https:\/\/+(?<host>[^/]+)\/?(?<path>.*)/u;
const HOST_WITH_PORT_REGEX = /.*:\d+$/u;

// rules-engine.ts（cli.js:336433-336437）。域名占位符那条作用在**已转义**的规则串上，
// 它找的是 `https:\/\/` 而不是 `https://`，后面跟着一个反斜杠（`\.` 那种转义）。
//
// 它今天改变不了任何一条结论：域名段带占位符或通配符的规则已经被
// `collectUnprovableHostFailures` 无条件判红了，走不走这一支，那一轮都是红的。留着
// 是为了跟 wrangler 逐行对齐——哪天那条无条件判红松了，这里的行为得已经是对的。
// 别为它写「守住了什么」的测试：现在没有能让它单独变红的输入。
const ESCAPE_REGEX_CHARACTERS = /[-/\\^$*+?.()|[\]{}]/gu;
const HOST_PLACEHOLDER_PATTERN =
  /(?<=^https:\\\/\\\/[^/]*?):([A-Za-z]\w*)(?=\\)/gu;

function escapeRegex(value) {
  return value.replace(ESCAPE_REGEX_CHARACTERS, "\\$&");
}

/** validateURL.ts 的 `extractPathname`：`/downloads/./*` 归一成 `/downloads/*`。 */
function extractPathname(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return new URL(`//${withLeadingSlash}`, "relative://").pathname;
}

/**
 * validateURL.ts 的 `validateUrl(token, false, true)`。返回归一化后的规则路径，
 * wrangler 会丢弃的写法返回 null。
 *
 * 三条判据都不是可选的：绝对 URL 只认 https（`ftp://` 会被丢）、带端口的域名会被
 * 丢、其余必须以 `/` 开头。
 */
function validateRulePath(token) {
  const absolute = URL_REGEX.exec(token);
  if (absolute?.groups?.host) {
    if (HOST_WITH_PORT_REGEX.test(absolute.groups.host)) return null;
    return `https://${absolute.groups.host}${extractPathname(absolute.groups.path ?? "")}`;
  }

  if (!token.startsWith("/")) return null;
  try {
    return extractPathname(token);
  } catch {
    return null;
  }
}

/** parseHeaders.ts 的 `validateNoMultipleWildcards`：违规返回 true。 */
function hasInvalidWildcards(rulePath) {
  const wildcardCount = (rulePath.match(SPLAT_PATTERN) ?? []).length;
  if (wildcardCount > 1) return true;
  return wildcardCount > 0 && /:splat(?!\w)/u.test(rulePath);
}

/** parseHeaders.ts 的 `isValidRule`：一条头都没有的规则整条不生效。 */
function isValidRule(rule) {
  return Object.keys(rule.headers).length > 0 || rule.unsetHeaders.length > 0;
}

/**
 * parseHeaders.ts 的 `parseHeaders`，只保留生效规则（wrangler 的 `invalid` 那半边
 * 这里不需要，被丢弃就等于不生效）。
 *
 * 按块解析而不是全文件查字符串：noindex 写在 `/images/*` 底下、`/downloads/*` 底下
 * 一条都没有时，两个子串都还在文件里，查字符串照样绿，而 PDF 已经能被收录。
 *
 * 最容易漏的一处：一条被丢弃的路由行会把它**底下的响应头一起吃掉**，而不是让那些
 * 头挂到上一个块名下。`/downloads/*` 后面紧跟一行 `ftp://bad.example/downloads/*`
 * 再跟一行 noindex，wrangler 的结果是 downloads 块没有任何头；把那两行并进
 * downloads 块，门禁就会说 PDF 有 noindex。承担这件事的是路由行分支里那句
 * `rule = null`。
 *
 * wrangler 在同一处还维护了一个 `skipUntilNextPath` 标志，这里没有移植：它所有的
 * 分支在 `rule` 为空时都只往 `invalid` 诊断列表里记一笔，不改变生效规则。移植进来
 * 是一段永远改变不了结果的装饰代码，反而让人以为它在守什么。
 */
function parseWranglerHeaderRules(input) {
  const rules = [];
  let rule = null;

  const commitPendingRule = () => {
    if (rule && isValidRule(rule)) rules.push(rule);
  };

  for (const rawLine of input.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    // 超长行被整行忽略。一条 2062 字符、归一化后是 `/downloads/*` 的规则，
    // wrangler 根本不看，门禁若认它就是假绿。
    if (line.length > MAX_LINE_LENGTH) continue;

    if (LINE_IS_PROBABLY_A_PATH.test(line)) {
      // 第 101 条规则以及之后的整段文件都不生效。wrangler 在这里 break，未提交的
      // 那条规则仍会在循环结束后补上，所以这里也照做。
      if (rules.length >= MAX_HEADER_RULES) break;
      commitPendingRule();
      // 必须清掉。不清的话，被丢弃的路由行底下那些头会继续挂在上一个块名下。
      rule = null;

      const rulePath = validateRulePath(line);
      if (rulePath === null || hasInvalidWildcards(rulePath)) continue;
      rule = { path: rulePath, headers: {}, unsetHeaders: [] };
      continue;
    }

    if (!line.includes(HEADER_SEPARATOR)) {
      // 撤销行必须是 `! ` 带空格开头，且整行不含冒号——`!X-Robots-Tag` 和
      // `! X-Robots-Tag:` 在 wrangler 眼里都不是撤销。
      if (rule && line.startsWith(UNSET_OPERATOR)) {
        // 不 trim。wrangler 写的是 `line.trim().replace("! ", "")`，只吃掉第一个
        // `"! "`，多出来的空格原样留在头名里。`!  X-Cache` 在它那里撤销的是
        // `" X-Cache"`——一个非法头名，运行时 `headers.delete()` 抛异常，整个响应
        // 500。这里替它 trim 掉就成了假绿：门禁拿干净名字去探，什么都探不出来。
        rule.unsetHeaders.push(line.replace(UNSET_OPERATOR, ""));
      }
      continue;
    }

    const [rawName, ...rawValue] = line.split(HEADER_SEPARATOR);
    const name = (rawName ?? "").trim().toLowerCase();
    if (name === "" || name.includes(" ")) continue;
    const value = rawValue.join(HEADER_SEPARATOR).trim();
    if (value === "" || !rule) continue;

    rule.headers[name] = rule.headers[name]
      ? `${rule.headers[name]}, ${value}`
      : value;
  }

  commitPendingRule();
  return rules;
}

/**
 * rules-engine.ts 的 `generateRuleRegExp`（cli.js:336445）。逐行照抄，包括那两个
 * `matchAll` + `split/join` 的写法——它不是「把每个占位符各自换掉」的等价写法。
 *
 * `matchAll` 拿到的是**替换开始之前**那份字符串的匹配列表，而每一轮 `split/join`
 * 会改写整条规则。名字互为前缀时这两件事会撞上：`/:x/:xfoo` 的匹配列表是
 * `[":x", ":xfoo"]`，处理 `:x` 时连 `:xfoo` 的前缀一起换掉，得到两个同名捕获组，
 * `RegExp` 抛 `SyntaxError`，`generateRulesMatcher` 的 catch 把整条规则丢掉。
 * 用一次 `.replace()` 各换各的就编译成功了——于是一条线上根本不存在的规则被算作
 * 生效，它「补回」的 noindex 或缓存全是假的。
 *
 * 占位符语法必须照抄：自己按感觉写成 `/:[a-z_]+/gi` 会漏，`\w` 含数字，
 * `:section2` 在 wrangler 眼里是一个完整占位符，会命中 `/downloads/catalog.pdf`。
 *
 * 名字也必须照抄，不能图省事换成匿名分组：`/:x/:x` 会生成两个同名捕获组，同样被
 * 整条丢掉；换成匿名分组它就成了一条正常规则——假绿。
 *
 * 正则不加 `u` 标志，wrangler 也没加（`RegExp(rule)`）。加了更危险：它转义出来的
 * `\-` 在 unicode 模式下是非法转义，`/downloads-archive/*` 这种正当规则编译不出来，
 * 被下面那个 `try/catch` 接住、**整条静默丢掉**。丢的是本该证明什么的规则，门禁于是
 * 少证明了一批文件却一句话都不说。（这里不会崩：抛出来的异常走的就是那个 catch。）
 *
 * 编译不出来返回 null，和 `generateRulesMatcher` 的 try/catch 一致，整条丢弃。
 */
function compileRulePattern(rulePath) {
  let source = rulePath.split("*").map(escapeRegex).join("(?<splat>.*)");

  for (const hostMatch of source.matchAll(HOST_PLACEHOLDER_PATTERN)) {
    source = source.split(hostMatch[0]).join(`(?<${hostMatch[1]}>[^/.]+)`);
  }
  for (const pathMatch of source.matchAll(NAMED_PLACEHOLDER_PATTERN)) {
    source = source.split(pathMatch[0]).join(`(?<${pathMatch[1]}>[^/]+)`);
  }

  try {
    return new RegExp(`^${source}$`);
  } catch {
    return null;
  }
}

/**
 * 一条规则怎么被拿去比对，照 `generateRulesMatcher`：`https://` 开头的规则比的是
 * `https://<域名><路径>`，其余规则只比路径。
 *
 * 只按规范路径匹配，不再另外算一套「编码别名」。曾经加过：`_headers` 是按请求里的
 * 原始编码路径匹配的，而 `cli.js` 里 Pages 的 asset-server 解码之后才去找文件，看
 * 起来 `/downloads/%63atalog.pdf` 这类规则能撤掉真实 PDF 的头。那是读错了子系统
 * ——这个仓库走的是 Workers Assets（`wrangler.jsonc` 的 `assets` 绑定），不是 Pages。
 * 2026-07-28 用锁定的 wrangler 4.100.0 起本地服务实测：`/downloads%2Fproduct-catalog.pdf`
 * 和 `/downloads/%70roduct-catalog.pdf` 都返回 307 跳到规范路径，文件根本不会在别名
 * 路径上被发出去。别再照着那段 Pages 代码把这套加回来。
 */
function ruleToMatcher(rulePath) {
  const pattern = compileRulePattern(rulePath);
  if (pattern === null) return null;

  const absolute = /^https:\/\/([^/]+)(\/.*)?$/u.exec(rulePath);
  const hostPart = absolute ? (absolute[1] ?? "") : null;

  return {
    host: hostPart,
    // 域名段里的占位符名字。它们的值只有知道真实域名才能算出来，而这里不知道
    // 线上会用哪个域名，所以拿它们拼出来的响应头是证明不了的（见
    // collectUnprovableHostFailures）。
    hostPlaceholders: hostPart === null ? [] : listPlaceholderNames(hostPart),
    pattern,
  };
}

/** `generateRulesMatcher` 里的 `test` 串：带域名的规则连域名一起比。 */
function toMatchTarget(host, targetPath, scopeHost) {
  if (host === null) return targetPath;
  return `https://${scopeHost}${targetPath}`;
}

function listPlaceholderNames(segment) {
  return [...segment.matchAll(NAMED_PLACEHOLDER_PATTERN)].map(
    (match) => match[1],
  );
}

/**
 * rules-engine.ts 的 `replacer`（cli.js:336439）：命中的捕获值会被替换进响应头的
 * **值**里，不只是用来判断命中。
 *
 * 漏掉这一步就有假绿：`/_next/static/:directive` 底下写 `Cache-Control: :directive`，
 * 构建产物里只要有一个文件叫 `no-store`，线上那条头就真的变成 `no-store`，一年缓存
 * 当场作废；而只看字面量 `:directive` 的话，它不在任何冲突指令名单里，检查全绿。
 */
function replacePlaceholders(value, replacements) {
  let result = value;
  for (const [name, captured] of Object.entries(replacements)) {
    result = result.replaceAll(`:${name}`, captured);
  }
  return result;
}

/**
 * 比较响应头时把空格抹平。
 *
 * `public,max-age=86400` 和 `public, max-age=86400` 是同一条头，HTTP 规范两种都
 * 合法。逐字符全等会在业主重排一次格式时变红，而意图完全没坏。
 *
 * 只抹分隔符两侧的空格，不抹 token 内部的。全删会让 `X-Robots-Tag: no index`
 * 判绿——Google 不认 `no index`，PDF 照样被收录，而门禁说没事。
 *
 * `=` 也算分隔符。真实客户端解析 Cache-Control 时按 name=value 取名字并 trim 掉
 * 两侧空白，`max-age = 0` 就是 `max-age=0`。不抹的话它变成一个前缀对不上的 token，
 * 「同时挂着第二个更短时长」那条冲突检测直接失明——换个写法就绿了。
 */
function normalizeHeaderValue(value) {
  return value.replace(/\s*([:,=])\s*/gu, "$1").toLowerCase();
}

/**
 * `X-Robots-Tag: none` 在 Google 的定义里等于 `noindex, nofollow`，比只写
 * noindex 更严。不展开就会把它判红，等于逼着业主把防护改弱。
 */
const ROBOTS_DIRECTIVE_ALIASES = new Map([["none", ["noindex", "nofollow"]]]);

function expandDirectives(name, directives) {
  if (name !== "x-robots-tag") return directives;

  const expanded = new Set();
  for (const directive of directives) {
    for (const alias of ROBOTS_DIRECTIVE_ALIASES.get(directive) ?? [
      directive,
    ]) {
      expanded.add(alias);
    }
  }
  return expanded;
}

/**
 * 拆成指令集合。
 *
 * 整行全等会把更强的写法判红：`X-Robots-Tag: noindex, nofollow` 比只写 noindex
 * 更严，门禁却拦下来，还报「does not carry X-Robots-Tag: noindex」——它明明带了。
 * 一个逼着业主不许加强防护的检查，该改的是检查。所以只要求「要的指令都在」，
 * 多出来的不管。
 */
function toDirectiveSet(name, value) {
  const tokens = splitOutsideQuotes(normalizeHeaderValue(value))
    .map((directive) => directive.trim())
    .filter(Boolean);
  return expandDirectives(name, new Set(takeGlobalDirectives(name, tokens)));
}

// `unavailable_after` 的值里就带冒号（日期时间），它是指令不是爬虫名。
const ROBOTS_DIRECTIVE_WITH_VALUE = "unavailable_after";

/**
 * `X-Robots-Tag` 可以按爬虫分别下指令，写法是 `<爬虫名>: <指令>[, <指令>…]`。
 * 关键在于：**爬虫名后面那一整串逗号分隔的指令都只属于那个爬虫**（Google 文档里
 * 的例子就是 `X-Robots-Tag: otherbot: noindex, nofollow`）。
 *
 * 只按逗号拆 token 会把 `bingbot: nosnippet, noindex` 里的 `noindex` 当成全局指令，
 * 门禁于是认为这份 PDF 带着 noindex；而 Googlebot 收到的那一行里没有一条对它生效，
 * PDF 照样被收录。所以碰到第一个带爬虫前缀的 token 就停，它和它后面的都不算数。
 */
function takeGlobalDirectives(name, tokens) {
  if (name !== "x-robots-tag") return tokens;

  const scopedIndex = tokens.findIndex((token) => {
    const separator = token.indexOf(HEADER_SEPARATOR);
    return (
      separator > 0 && token.slice(0, separator) !== ROBOTS_DIRECTIVE_WITH_VALUE
    );
  });
  return scopedIndex === -1 ? tokens : tokens.slice(0, scopedIndex);
}

/**
 * 引号没配对的头值没法可靠地拆，直接判「算不出来」。
 *
 * 拆分器碰到不闭合的引号会把后面所有内容吞进一个 token，`no-store` 就查不出来了，
 * 而线上那条头是真的带着它。畸形头各家客户端行为未定义，这里不猜，判红。
 */
function hasUnbalancedQuotes(value) {
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (quoted && value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === '"') quoted = !quoted;
  }
  return quoted;
}

/**
 * 按逗号拆，但引号里的逗号不算分隔符。
 *
 * HTTP 的字段值允许 quoted-string，里面的逗号是内容而不是分隔符。直接
 * `split(",")` 会把 `foo="x,public,max-age=31536000,immutable,y"` 拆成一堆看起来
 * 正好凑齐期望的 token，而线上那条头只有 `foo=...` 一个扩展指令，一年缓存根本
 * 不存在——每个真实 bundle 都会假绿。反斜杠在引号内是转义，跳过它后面那个字符。
 */
function splitOutsideQuotes(value) {
  const parts = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted && character === "\\") {
      current += character + (value[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      current += character;
      continue;
    }
    if (character === "," && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  parts.push(current);
  return parts;
}

/** 把 `X-Robots-Tag: noindex` 这种期望写法拆成「头名 + 指令集合」。 */
function parseExpectedHeader(line) {
  const [rawName, ...rest] = line.split(HEADER_SEPARATOR);
  const name = (rawName ?? "").trim().toLowerCase();
  return {
    name,
    directives: toDirectiveSet(name, rest.join(HEADER_SEPARATOR)),
  };
}

/**
 * 算出某个路径最终真正拿到的响应头：所有命中的规则按声明顺序依次作用，每条规则
 * 先撤销再设置，同名头的指令并起来。
 *
 * 这一段没有可引的源码行号。Workers Assets 那一侧套响应头的代码在
 * `workers-shared/asset-worker/src/utils/headers.ts`，被 tree-shake 掉了，cli.js 里
 * 只剩一个 init 桩。bundle 里唯一叫 `attachHeaders` 的函数在
 * `pages-shared/asset-server/handler.ts`（cli.js:336860），那是 **Cloudflare Pages**
 * 的子系统，这个仓库用的不是它——前面有两轮审查读错子系统、结论作废，注释里曾经
 * 就指着那一行，等于把下一个审查者直接送进同一个坑。
 *
 * 所以这四条语义是 2026-07-28 用真服务实测出来的，wrangler 4.100.0 /
 * `wrangler dev --local` / Workers Assets，`/downloads/*` 块设了 noindex 和
 * `Cache-Control: public,max-age=86400`：
 *
 * - 后面的块再设同名头 → 两条并存（`x-robots-tag: noindex` 和 `nofollow` 各一行）。
 * - 后面的块 `! X-Robots-Tag` → 前面块设的那条被撤掉。
 * - 同一块里先 `! X-Robots-Tag` 再设 `X-Robots-Tag: none` → 结果是 `none`，
 *   也就是每条规则内部先撤销后设置。
 * - 后面的块设 `Cache-Control: no-store` → 值拼成 `public,max-age=86400, no-store`。
 *
 * 只比对「路由字符串完全相等」的块会同时错两个方向：
 *
 * - 假绿：`/downloads/*` 底下写着 noindex，但下面再写一个更具体的
 *   `/downloads/private.pdf` 加一行 `! X-Robots-Tag`，就能把它撤掉。
 * - 假红：同一条头被拆到两个块里（`Cache-Control: public, max-age=…` 一块、
 *   `Cache-Control: immutable` 另一块），线上会合并成完整的一条。
 *
 * 带域名的规则要**按域名分场景算**，不能和无域名规则拌在一锅里。一次请求只落在
 * 一个域名上，`https://a.example/...` 和 `https://b.example/...` 的规则在线上永远
 * 不会同时生效。拌在一起就会互相抵消：a 那条追加 `no-store`、b 那条把
 * `Cache-Control` 整个撤掉、后面再有一条无域名规则补回期望值，合起来看毫无问题，
 * 而 a.example 上那次响应实际带着 no-store，一年缓存的保证是假的。
 *
 * 所以场景 = 一个「没有域名」的场景，加上文件里出现过的每一个域名各一个场景。
 * 每个场景独立算一遍，任何一个场景没达到期望，整体就算失败。「没有域名」那个场景
 * 顺带把「只在某个域名下写了 noindex」挡掉：那个场景里它根本不存在。
 *
 * 场景只按**纯字面量**的域名分。带占位符或通配符的域名段在别处被整条判红（见
 * `collectUnprovableHostFailures`），不会走到这里——它们的字面量本身能被别的规则
 * 的域名模式吃掉（`":h"` 不含点，`(?<h>[^/.]+)` 一口吞下），那样算出来的场景在
 * 线上根本不存在。
 *
 * 攒的是**拼接后的原始头值**，不是各自拆好的指令集合。wrangler 用
 * `Headers.append` 把多条命中规则的同名头拼成一条 `A, B`，客户端只解析一次；
 * 逐条各拆各的会和它对不上——比如前一条留一个不闭合的引号、后一条把它关掉，拼起来
 * `no-store` 在引号外是真指令，分开看却被吞进 token 里。
 */
function resolveEffectiveHeaders(rules, targetPath, scopeHost) {
  const effective = new Map();

  for (const rule of rules) {
    const matcher = ruleToMatcher(rule.path);
    if (matcher === null) continue;
    const { host, pattern } = matcher;
    // 「没有域名」那个场景里，带域名的规则不算数。
    //
    // 它今天改变不了任何一条结论：把这一行删掉，带域名的规则会拿去和
    // `toMatchTarget` 拼出来的 `https://null/…` 比，而域名是纯字面量的规则谁也匹配
    // 不上这串（域名不是字面量的规则早被 `collectUnprovableHostFailures` 判红了）。
    // 留着是因为它写的才是真正的语义，`toMatchTarget` 那串是垃圾值，不该被依赖。
    // 别为它写「守住了什么」的测试：现在没有能让它单独变红的输入。
    if (host !== null && scopeHost === null) continue;
    const match = pattern.exec(toMatchTarget(host, targetPath, scopeHost));
    if (match === null) continue;

    for (const unsetName of rule.unsetHeaders) {
      effective.delete(unsetName.toLowerCase());
    }

    for (const [name, value] of Object.entries(rule.headers)) {
      const resolved = replacePlaceholders(value, match.groups ?? {});
      const existing = effective.get(name);
      effective.set(
        name,
        existing === undefined ? resolved : `${existing}, ${resolved}`,
      );
    }
  }

  return effective;
}

/**
 * 文件里出现过的域名，加上「没有域名」那个场景（用 null 表示）。
 *
 * 域名要按 URL 的规矩归一化之后才能当场景用。wrangler 比对的是
 * `new URL(request.url).hostname`（cli.js:336471）——那个值一定是小写的，IDN 也已经
 * 转成 punycode；规则那一侧却原样保留（cli.js:129014），编译出来的正则又不带 `i`
 * （cli.js:336456）。所以 `https://TUCSENBERG.example/downloads/*` 这条规则线上永远
 * 命中不了任何请求。
 *
 * 拿字面量当场景的话，它在门禁眼里反倒是生效的：一条写在里面的 `! X-Robots-Tag`
 * 会让门禁判红，并打印一句不成立的话——那份 PDF 在任何真实域名上都带着 noindex。
 */
function listHeaderScopes(rules) {
  const hosts = new Set();
  for (const rule of rules) {
    const matcher = ruleToMatcher(rule.path);
    if (matcher === null || matcher.host === null) continue;
    const hostname = toHostname(matcher.host);
    // 取不出域名的不造场景（`:host` 这类占位符会让 URL 解析直接抛异常）。它们
    // 已经被 collectUnprovableHostFailures 无条件判红，这里再猜一个场景只会多一句
    // 废话。通配符 `*.example.com` 是能解析的，照常造场景——反正也是无条件判红。
    if (hostname !== null) hosts.add(hostname);
  }
  return [null, ...hosts];
}

function toHostname(host) {
  try {
    return new URL(`https://${host}`).hostname;
  } catch {
    return null;
  }
}

module.exports = {
  hasUnbalancedQuotes,
  listHeaderScopes,
  parseExpectedHeader,
  parseWranglerHeaderRules,
  resolveEffectiveHeaders,
  ruleToMatcher,
  toDirectiveSet,
};
