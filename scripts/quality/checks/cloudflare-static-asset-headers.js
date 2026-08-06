const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const {
  hasUnbalancedQuotes,
  listHeaderScopes,
  parseExpectedHeader,
  parseWranglerHeaderRules,
  resolveEffectiveHeaders,
  ruleToMatcher,
  toDirectiveSet,
} = require("./wrangler-headers-semantics.js");

const EXPECTED_STATIC_ASSET_CACHE_CONTROL = "public,max-age=31536000,immutable";
const EXPECTED_DOWNLOADS_NOINDEX = "X-Robots-Tag: noindex";
// 两类被证明的资源：源目录 → 它们最终的 URL 前缀。写死一条探针路径证明不了什么，
// 以前那条 `/_next/static/chunks/main.js` 在构建产物里根本不存在，真实文件名全带
// 内容哈希；只要撤销精确落在某个真实哈希文件上，那条虚构探针毫无反应。
const PUBLIC_SOURCE_DIR = "public";
const DOWNLOADS_SOURCE_DIR = "public/downloads";
const DOWNLOADS_ASSET_SUBDIR = "downloads";
const STATIC_ASSET_SUBDIR = "_next/static";
// 询盘物料的扩展名。这些文件不管放在哪个目录，被发布出去就必须带 noindex。
//
// 只按 `downloads/` 这个目录名判是不够的，而且漏的方式一点都不离奇：把新报价单
// 放进 `public/` 而不是 `public/downloads/`，线上那条 `/quotation.pdf` 上没有任何
// `X-Robots-Tag` 规则，六道检查一路绿灯。放错一层目录就够了，不需要谁改坏什么。
//
// 判据是文件本身而不是它所在的目录，所以整棵发布出去的树都要扫，构建产物那一侧也
// 一样——那边不是 `public/` 的镜像，落进资产目录的东西就会被发出去，而
// `_next/static` 那棵子树此前只被问过缓存、从没被问过 noindex。
//
// 这张表是这套检查**实际会拦**的类型，不是「Google 只收录这些」。
const INDEXABLE_DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".txt",
]);
// `.txt` 在表里，但按标准必须给爬虫读的那几个文件要放行。
//
// 放行只认这三条**完整路径**，不是目录前缀，也不是扩展名。两种更宽的写法各自漏过
// 一批东西，而且都是这几轮里真实发生过的：排除写成「所有 .txt」，一份
// `quotation.txt` 的价目表整个滑过去；放行写成「`.well-known/` 底下的一切」，一份
// `public/.well-known/quotation.pdf` 白白溜出去；改成「`.well-known/` 底下的 .txt」，
// 价目表换个目录又滑过去了。放行的宽度只该正好等于它的理由。
//
// 依据是这三条各自的规范都把位置钉死了：robots.txt 必须在站点根（RFC 9309 §2.3
// "Access Method"），security.txt 在 `.well-known/` 下（RFC 9116），ads.txt 在站点根
// （IAB Tech Lab ads.txt 规范）。多一条要放行时，照样得先拿出它的规范。
const CRAWLER_FACING_PATHS = new Set([
  "/robots.txt",
  "/ads.txt",
  "/.well-known/security.txt",
]);

function isCrawlerFacing(servedPath) {
  return CRAWLER_FACING_PATHS.has(servedPath);
}
const SOURCE_HEADERS_PATH = "public/_headers";
const ASSET_HEADERS_FILENAME = "_headers";
const ASSET_REDIRECTS_FILENAME = "_redirects";
const ASSET_ASSETSIGNORE_FILENAME = ".assetsignore";
const WRANGLER_CONFIG_PATH = "wrangler.jsonc";
// `assets` 底下这套检查真正建模了的键。`binding` 只把资产绑定暴露给 Worker 代码，
// 不改变任何一条 URL 或响应头，所以它在白名单里。
const MODELLED_ASSET_CONFIG_KEYS = new Set(["directory", "binding"]);
// wrangler 4.100.0 认得、但这套检查没建模的键（cli.js:40198-40204 那份白名单减去上面
// 两个）。它们真的会改变资产怎么被发出去：
//
// `html_handling`——整套 `.html` 别名的说法只在它取默认值时成立。2026-07-28 实测，
// 设成 `"none"` 之后 `/downloads/x.pdf.html` 返回 200、`/downloads/x.pdf` 是 404，
// 文件就在它自己那条 URL 上发出去，别名根本不存在，而门禁照旧说它「从去掉扩展名的
// 那条 URL 发出去，这套检查证明不了」。`run_worker_first` 更彻底：请求整个交给
// Worker，`_headers` 一条都不参与，这份门禁的每一条结论都会作废。
//
// 记的是**默认值**，不是键名。写成默认值的那份配置和不写，发布出去的行为一样，对它
// 说「这套检查建模不了」是假的——而且业主为了写清楚把默认值显式写出来是很常见的做
// 法，把他拦下来就是纯误红。
//
// 前两个的默认值来自 asset worker 自己的兜底（assets.worker.js:7962-7963，那是
// Workers Assets 的 asset-worker，不是 Pages）。`run_worker_first` 不在那个函数里，
// 它走的是另一套：不写的话 `invoke_user_worker_ahead_of_assets` 这个键根本不出现
// （cli.js:163211），写 `false` 则以 false 出现。所以上传的 JSON 不是逐字节相同，
// 只是发布行为相同——这里说的是后者。
const UNMODELLED_SERVING_ASSET_CONFIG_DEFAULTS = new Map([
  ["html_handling", "auto-trailing-slash"],
  ["not_found_handling", "none"],
  ["run_worker_first", false],
]);
// 「先跑构建」这句提示只能跟着**构建产物**那一侧的失败走。判据是路径，不是措辞：
// 同一句「里面没文件」既会说 `public/downloads`（git 跟踪的源目录，构建一万次也是
// 同一条红），也会说 `.open-next/assets/downloads`。所以两侧各用各的措辞，提示认
// 构建产物那两句。业主不懂技术，判红时唯一那句行动建议要是不成立，他就只能去做
// 一件毫无效果的事。
const MISSING_SOURCE_HEADER_FILE = "missing source header file";
const MISSING_BUILT_HEADER_FILE = "missing Cloudflare build output header file";
const HOLDS_NO_FILES = "holds no files";
const HOLDS_NO_BUILT_FILES = "holds no built files";

/**
 * 读文件，失败时把**错误码**带回来，和 readdirOrError / statOrError 一个道理。
 *
 * `existsSync` 说「在」和「读得出来」是两件事。`_headers` 权限不对、或者那个路径其实
 * 是个目录时，直接 `readFileSync` 会把门禁变成崩溃：业主看到的是一段堆栈，一句失败
 * 都没有，而 CI 上这和「检查真的跑过并且通过了」长得完全不一样。
 */
function readRepoFileOrError(context, relativePath) {
  try {
    return {
      text: context.readFileSync(
        path.join(context.rootDir, relativePath),
        "utf8",
      ),
    };
  } catch (error) {
    return { code: error?.code ?? "UNKNOWN" };
  }
}

function repoFileExists(context, relativePath) {
  return context.existsSync(path.join(context.rootDir, relativePath));
}

/**
 * 磁盘文件名要转义之后，才是线上真正被请求的路径。
 *
 * 直接拼文件名会漏：`catalog copy.pdf` 在线上是 `/downloads/catalog%20copy.pdf`，
 * 一条写成 `%20` 的撤销规则会命中它，而门禁拿着带空格的原名去比，什么都没匹配上，
 * 于是 PDF 能被收录而门禁全绿。
 *
 * 转义规则照抄 asset worker 的 `encodePath`（assets.worker.js:8796）：按 `/` 切段，
 * 每段各自 `encodeURIComponent`。这不是 `new URL().pathname`——那一版曾经用过，
 * 但两者在可打印 ASCII 上有十几个字符不一致：`# $ % & + , : ; = ? @ [ \ ] |`，
 * `new URL()` 都原样留着或另作处理。空格**不在**这张表里，两边都转成 `%20`——它是
 * 上面那段「直接拼文件名会漏」的论据，不是这两种实现的差异。asset worker 只在
 * `encodePath(路径)` 上返 200，别的形式一律 307 跳过去（assets.worker.js:8271），
 * 所以这些字符里只要有一个
 * 出现在文件名里，门禁算出来的就不是那条真正会发文件的 URL，落在真 URL 上的撤销它
 * 完全看不见。
 *
 * 这里不写具体数字，也不把那张表钉成断言：它是 Node 的 URL 实现和 `encodeURIComponent`
 * 两边行为的差集，随版本会变，而这段代码要守的是「照抄 encodePath」，不是「差集恰好
 * 是这几个字符」。`%` 尤其要留意，它在这张表里而且后果最重：文件名里一个字面的 `%`
 * 和一个百分号转义序列，`new URL()` 那一版分不开。2026-07-28 实测：文件名 `spec,rev2.pdf`，
 * `/downloads/spec,rev2.pdf` 返 307，`/downloads/spec%2Crev2.pdf` 返 200 且没有
 * `x-robots-tag`，而门禁全绿。
 */
function toServedPath(urlPrefix, relativePath) {
  return [urlPrefix, ...relativePath.split("/")]
    .map((segment, index) =>
      index === 0 ? segment : encodeURIComponent(segment),
    )
    .join("/");
}

/**
 * 列出真实发布出去的文件。
 *
 * 探一条写死的路径只能证明那一条路径，而撤销可以精确落在某个真实文件上
 * （`/downloads/supplier-checklist.pdf` 加一行 `! X-Robots-Tag`），也可以用占位符
 * 绕开（`/:section/private.pdf`）。所以逐个真实文件算它最终拿到的头，规则会不会
 * 命中交给同一套匹配逻辑判断，不靠字符串前缀猜。
 *
 * 点号开头的文件也要算。Workers Assets 只在资产根目录排除 `.assetsignore`、
 * `_redirects`、`_headers` 三个（wrangler 4.100.0 cli.js:124017），别的点号文件照
 * 常上传。2026-07-28 实测：把一份 PDF 复制成 `.open-next/assets/downloads/
 * .secret-probe.pdf` 后 `wrangler dev --local` 起服务，请求
 * `/downloads/.secret-probe.pdf` 返回 200 和完整 PDF。过滤掉它们等于放过一份
 * 能被搜索引擎抓到、却没人证明带 noindex 的下载。
 *
 * 符号链接也要算，**文件和目录都算**。wrangler 建上传清单时是
 * `fs.readdir(dir, { recursive: true })` 加 `fs.stat(filepath)`（cli.js:137571）：
 * 递归枚举会走进符号链接目录，`stat` 又会跟随链接，所以链接背后是普通文件就照传，
 * 那句 `filestat.isSymbolicLink()` 对 `stat` 来说永远为假。
 *
 * 所以「是不是目录」必须问 `statSync`，不能问 `Dirent`：`Dirent.isDirectory()` 对
 * 「指向目录的符号链接」是 false，整棵子树会被静默跳过。2026-07-28 实测：
 * `.open-next/assets/downloads/linked` 链到另一个目录，里面的 PDF 从
 * `/downloads/linked/inside.pdf` 返回 200 且没有 `x-robots-tag`，门禁全绿。
 */
function listServedPaths(context, sourceDir, urlPrefix, relative = "") {
  const absolute = path.join(context.rootDir, sourceDir, relative);
  const here = relative ? `${sourceDir}/${relative}` : sourceDir;
  // 这里不能直接 readdirSync：`public/downloads` 要是一个普通文件，它抛 ENOTDIR，
  // 门禁变成崩溃而不是判断。
  const { entries, code } = readdirOrError(context, absolute);
  if (entries === undefined) {
    if (isAbsentDirectory(code)) return { paths: [], failures: [] };
    // 别的原因列不出来（权限、EMFILE、EIO，或者并发构建把它删了）。返回空数组
    // 等于说「里面没东西」——这一整棵子树一个文件都没被证明过，必须有人说出来。
    return {
      paths: [],
      failures: [
        `${here} could not be listed (${code}), so nothing under it is proven`,
      ],
    };
  }

  const paths = [];
  const failures = [];
  for (const entry of entries) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    const { stats, code: statCode } = statOrError(
      context,
      path.join(absolute, entry.name),
    );
    if (stats === undefined) {
      // 断链指向的东西不在了，跟着它走本来就走不到任何会被上传的文件。别的原因
      // 看不了，这个条目是目录还是 PDF 都不知道，得说出来。
      if (!isAbsentDirectory(statCode)) {
        failures.push(
          `${here}/${entry.name} could not be inspected (${statCode}), so it is not proven`,
        );
      }
      continue;
    }
    // 目录本身不是可证明的东西。不递归的话 `/downloads/nested` 会被当成一个
    // 文件去探，它底下真实的 PDF 一个都没查，而门禁看起来在干活。
    if (stats.isDirectory()) {
      const nested = listServedPaths(context, sourceDir, urlPrefix, next);
      paths.push(...nested.paths);
      failures.push(...nested.failures);
      continue;
    }
    // 判据抄 wrangler 的：它只排掉目录和符号链接（cli.js:137583），**没有**要求是
    // 普通文件。而 `stat` 跟随链接之后 `isSymbolicLink()` 恒为假，所以实际效果是
    // 「不是目录就上传」。改成只认 `isFile()` 是拿一个更严的近似替原样移植，FIFO、
    // socket、设备节点会被这边跳过、被 wrangler 传上去，成为没人证明过的资源。
    if (!stats.isDirectory()) paths.push(toServedPath(urlPrefix, next));
  }

  return { paths: paths.sort(), failures };
}

/**
 * 受保护目录在磁盘上叫的是不是 URL 里那个名字。
 *
 * 目录名不能用写死的字面量。macOS 默认的 APFS 不区分大小写：磁盘上是 `Downloads/`
 * 时，`existsSync(".open-next/assets/downloads")` 照样返回 true，门禁于是按
 * `/downloads/x.pdf` 求响应头、全绿。而 wrangler 建上传清单拿的是 readdir 给出的
 * 原始条目名（cli.js:137571），线上那条 URL 是 `/Downloads/x.pdf`，`/downloads/*`
 * 那条规则匹配不上它（正则不带 `i`）。2026-07-28 实测：`wrangler dev --local` 下
 * `/Downloads/secret.pdf` 返回 200 且没有 `x-robots-tag`，`/downloads/secret.pdf`
 * 是 404。六份询盘 PDF 会全部裸奔，而业主本机上门禁一片绿。
 *
 * 判据只能是「readdir 里有没有一模一样的名字」，不能拿 `toLowerCase()` 比。磁盘的
 * 折叠表比 JS 的大小写表大：本机实测 `ſ`（U+017F）在磁盘上等于 `s`，而
 * `"downloadſ".toLowerCase()` 还是它自己。
 *
 * 名字对不上时不去猜磁盘上那个真名是谁——猜错了后面每一条证明说的都是另一条 URL。
 * 直接判 folded，那个目录一条路径都不列，由调用方打印一句成立的话。有一版是判红
 * 之后照旧按写死的前缀逐文件证明，于是同一次运行里前两行说「这条 URL 我算不出来」，
 * 后几行接着拿那条算不出来的 URL 下结论，而那些结论两个方向都不成立。
 *
 * 「答不上来」必须和「答案是否」分开，而且答不上来时也要停。上一版把 readdir 失败
 * 当成「不折叠」，理由是「列不出来的目录名字本身没有可疑之处」。这句话是错的：在
 * 不区分大小写的卷上，上层列不出来、下层用折叠名照样列得动，于是三个环节全都不说话，
 * 门禁按写死的前缀「证明」了一批线上根本不存在的 URL，输出零条失败。第 21 轮实测：
 * `.open-next/assets` 权限 0111、里面是 `Downloads/catalog.pdf` 时门禁全绿，而
 * `wrangler dev --local` 下 `/Downloads/catalog.pdf` 返回 200 且没有 `x-robots-tag`，
 * `/downloads/catalog.pdf` 是 404。
 *
 * 上层目录不在则不算答不上来：不存在的东西没有名字可折叠，也没有文件要证明，那条
 * 路径交给「目录里没东西」去报，那是业主没跑构建时最常撞上的一条。
 *
 * 只解析会进 URL 的那几段。`public`、`.open-next`、`assets` 被 wrangler 完全剥掉
 * （清单路径是相对资产根算的），它们叫什么都不改变任何一条 URL。
 */
function resolveServedDirName(context, baseDir, urlSubdir) {
  let parent = path.join(context.rootDir, baseDir);
  let parentDir = baseDir;

  for (const segment of urlSubdir.split("/")) {
    const { entries, code } = readdirOrError(context, parent);
    const next = path.join(parent, segment);
    if (entries === undefined) {
      if (isAbsentDirectory(code)) return { state: "exact" };
      return { state: "unknown", parentDir, code };
    }
    if (!entries.some((entry) => entry.name === segment)) {
      // 一模一样的名字找不到、路径却又「存在」，说明是文件系统替我们折叠了名字。
      // 目录压根不在时不算折叠，由「目录里没东西」那条去报。
      return { state: context.existsSync(next) ? "folded" : "exact" };
    }
    parent = next;
    parentDir = `${parentDir}/${segment}`;
  }

  return { state: "exact" };
}

function collectUnresolvedDirectoryFailures(context, baseDir, urlSubdir) {
  const sourceDir = `${baseDir}/${urlSubdir}`;
  const { state, parentDir, code } = resolveServedDirName(
    context,
    baseDir,
    urlSubdir,
  );
  // 「算不出来」是这个检查的选择，不是世界的性质：真名在磁盘上，比对 inode 就能拿到。
  // 所以话要说成「这个检查算不出来」，不能说成「没人算得出来」。
  // 只说非文档文件。文档类的已经被整棵树的扫描按磁盘真名逐条证明过了，这里再说一句
  // 「算不出它们的 URL」，就是同一份报告里两句话互相打架。
  if (state === "folded") {
    return [
      `${sourceDir} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
    ];
  }
  // 指名**真正列不出来的那个目录**，也就是上层。说「下层列不出来」是假的——同一次
  // 运行里它很可能被列了个干净。
  if (state === "unknown") {
    return [
      `${parentDir} could not be listed (${code}), so this check cannot tell whether ${sourceDir} is spelled the same on disk as in the URL`,
    ];
  }
  return [];
}

/**
 * 列目录，失败时把**错误码**一起带回来。
 *
 * 只返回 null 是不够的：`ENOENT`（目录不在）和 `EACCES`（列不出来）在这个门禁里是
 * 两件相反的事。前者说明没有可证明的东西，后者说明有一批文件没被证明过——把它们
 * 混成一个 null，要么会对着不存在的目录说「列不出来」，要么会把一整棵子树的文件
 * 静默跳过而一句话都不说。
 */
function readdirOrError(context, absolutePath) {
  try {
    return {
      entries: context.readdirSync(absolutePath, { withFileTypes: true }),
    };
  } catch (error) {
    return { code: error?.code ?? "UNKNOWN" };
  }
}

/** 目录不在、或者那个路径根本不是目录：没有可证明的东西，不是「列不出来」。 */
function isAbsentDirectory(code) {
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * 看一个条目到底是什么，失败时把**错误码**一起带回来。
 *
 * 和 readdirOrError 是同一个道理，而且这一层更容易漏：readdir 成功、stat 失败是
 * 真实存在的一档。目录权限是 444 时 readdir 列得出名字，stat 每个孩子都抛 EACCES。
 * 只返回 null 的话，这些孩子既不算目录也不算文件，被静默丢掉——一整棵子树的 PDF
 * 一个都没被证明，而门禁报零条失败。
 */
function statOrError(context, absolutePath) {
  try {
    return { stats: context.statSync(absolutePath) };
  } catch (error) {
    return { code: error?.code ?? "UNKNOWN" };
  }
}

/**
 * 同一条路由写两个块，不是「合并」，是「后一个整块盖掉前一个」。
 *
 * 锁定的 wrangler 4.100.0 在构造静态资源 header metadata 时写的是
 * `rules[rule.path] = configuredRule`（cli.js:335300），后写的整块覆盖先写的，
 * 先写的那些头就此消失。把它们合起来是门禁在替线上做主，结果是假绿。
 *
 * 这里不替它猜哪个是本意，直接判红。比的是 wrangler 归一化之后的键，
 * `/downloads/*` 和 `/downloads/./*` 在它那里是同一个键。
 */
function collectDuplicateRouteFailures(rules, relativePath) {
  const seen = new Set();
  const duplicated = new Set();

  for (const rule of rules) {
    if (seen.has(rule.path)) duplicated.add(rule.path);
    seen.add(rule.path);
  }

  return [...duplicated].map(
    (rulePath) =>
      `"${rulePath}" is declared more than once in ${relativePath}; wrangler keeps only the last block and silently drops the earlier headers`,
  );
}

/**
 * 「要的指令都在」对 Cache-Control 不够，它还得没被别的指令推翻。
 *
 * 多条规则命中同一条头时 wrangler 用 `Headers.append` 拼接，指令是并起来而不是
 * 覆盖。通配块给了一年 immutable，再给某个真实 bundle 追加一行
 * `Cache-Control: no-store`，三个期望 token 一个不少，而那个文件线上一秒都不会被
 * 缓存——门禁却说缓存到位。
 *
 * X-Robots-Tag 不需要这一层：多一条 nofollow 只会更严，Google 也取最严的那条。
 * Cache-Control 相反，最严的那条会把期望整个作废。
 */
const CACHE_CONTROL_CONTRADICTIONS = new Set([
  "no-store",
  "no-cache",
  "private",
]);
const CACHE_CONTROL_AGE_DIRECTIVES = ["max-age", "s-maxage"];

function findContradictingDirectives(name, expected, actual) {
  if (name !== "cache-control") return { overriding: [], ambiguous: [] };

  // 比的是 `=` 前面那个名字。客户端按 name=value 取名字，`no-store=1` 的名字就是
  // no-store，真实浏览器照样不缓存；只比整词的话加个 `=1` 就绕过去了。
  const overriding = [...actual].filter((directive) =>
    CACHE_CONTROL_CONTRADICTIONS.has(directive.split("=")[0] ?? directive),
  );

  // 期望里写了 max-age=31536000，实际却同时挂着另一个时长（或者 s-maxage=0），
  // 线上按哪个算是不确定的，同样不能算证明。
  //
  // 但这一档和上面那档不是一回事，两句话不能共用一个措辞。`no-store` 是确定压过
  // 一年缓存的，说「覆盖」成立；两个时长并排时哪个赢**不确定**——一边在注释里说
  // 不确定、一边对业主说 Y 覆盖了 X，是拿一个没做过的判断当结论讲。
  const ambiguous = [];
  for (const ageDirective of CACHE_CONTROL_AGE_DIRECTIVES) {
    const prefix = `${ageDirective}=`;
    for (const directive of actual) {
      if (directive.startsWith(prefix) && !expected.has(directive)) {
        ambiguous.push(directive);
      }
    }
  }

  return { overriding, ambiguous };
}

/**
 * `Vary: *` 在不在这条路径最终的响应头里。
 *
 * 逐个 token 比，不能用 `includes("*")`：`Vary: Accept-Encoding` 里没有星号，但
 * `Vary: X-*-Probe` 这种自定义头名里有，按子串判会误红。
 */
function hasWildcardVary(effective) {
  const vary = effective.get("vary");
  if (vary === undefined) return false;
  return vary.split(",").some((token) => token.trim() === "*");
}

function collectScopeFailures(
  rules,
  relativePath,
  targetPath,
  expectedHeader,
  scopeHost,
) {
  const wanted = parseExpectedHeader(expectedHeader);
  const effective = resolveEffectiveHeaders(rules, targetPath, scopeHost);
  const served = effective.get(wanted.name);
  // 无域名场景不加后缀，报错信息保持原样；域名场景点出是哪个域名，否则业主看到
  // 一条红字却不知道该去改哪一块。
  const where = scopeHost === null ? "" : ` on https://${scopeHost}`;

  if (served === undefined) {
    return [
      `${targetPath} in ${relativePath} is served without "${wanted.name}"${where}`,
    ];
  }

  if (hasUnbalancedQuotes(served)) {
    return [
      `${targetPath} in ${relativePath} is served "${wanted.name}: ${served}"${where}, whose quotes do not close, so what it actually means cannot be proven`,
    ];
  }

  const actual = toDirectiveSet(wanted.name, served);
  const missing = [...wanted.directives].filter(
    (directive) => !actual.has(directive),
  );
  if (missing.length > 0) {
    return [
      `${targetPath} in ${relativePath} does not carry "${expectedHeader}"${where}`,
    ];
  }

  // 缓存时长会被另一个头整条废掉，而 `Cache-Control` 自己一个字都没变。
  // `Vary: *` 的意思是「这个响应不能被复用」（RFC 9111 §4.1 说得最直接：带 `*` 的
  // 存储响应永远匹配不上），一年 immutable 写得再对也不会发生。只盯着同名头比对的话，
  // 这里是彻底的假绿。
  //
  // 位置必须排在「头在不在」「值对不对」之后。排在前面的话，一个根本没写
  // `Cache-Control` 的配置也会被告知「你写的一年缓存被 Vary 废了」——业主删掉 Vary
  // 重跑，才发现缓存头压根没写，两趟才走完一趟的事。
  if (wanted.name === "cache-control" && hasWildcardVary(effective)) {
    return [
      `${targetPath} in ${relativePath} carries "${expectedHeader}" but "Vary: *" beside it${where} means no cache may reuse the response, so the lifetime never applies`,
    ];
  }

  const { overriding, ambiguous } = findContradictingDirectives(
    wanted.name,
    wanted.directives,
    actual,
  );
  if (overriding.length > 0) {
    return [
      `${targetPath} in ${relativePath} carries "${expectedHeader}" but ${overriding.join(", ")} overrides it${where}`,
    ];
  }
  if (ambiguous.length > 0) {
    return [
      `${targetPath} in ${relativePath} carries "${expectedHeader}" but ${ambiguous.join(", ")} sits beside it${where}, so which one applies cannot be proven`,
    ];
  }

  return [];
}

/**
 * 这份文档是不是就在下载目录里，只是那个目录的名字被文件系统折叠了。
 *
 * 两个条件都要成立，缺一个都会吞掉一句业主能照着做的话。
 *
 * 一、这一侧的 `downloads` 确实是折叠来的。抑制这句建议的全部正当性，是「该做什么
 * 另一句红字已经说了」，而那句话只在判 folded 时才出现。别名（符号链接、硬链接）也
 * 能让两条路径指向同一个对象，但那时 readdir 里躺着一模一样的 `downloads`，判的是
 * exact，那句话不出现。真机实测：`public/dl` 链到 `downloads` 时，`/dl/catalog.pdf`
 * 判红，而 `/downloads/*` 那条规则匹配不到这条 URL——「写条规则盖住它」正是他要做的
 * 事，把整句吞掉，他拿到的是一句无处下手的红字。
 *
 * 二、这条 URL 的顶层那一段，跟 `downloads` 是磁盘上的同一个对象。问的是身份，不是
 * 名字：`dev` + `ino` 相等才算数，这是文件系统自己对「这两条路径是不是同一个东西」的
 * 回答。本机 APFS 实测：磁盘上是 `Downloads/` 时，按 `downloads` 查到的 `dev:ino` 与
 * 按真名查到的完全相同，同一层的兄弟目录不同。
 *
 * 名字比不出来。磁盘的折叠表比 JS 的大：本文件 250 行那段实测的 `ſ`（U+017F）在 APFS
 * 上等于 `s`，`"downloadſ".toLowerCase()` 却还是它自己；URL 里那一段还是转义过的
 * （`download%C5%BF`）。
 *
 * 只看第一条也不行。折叠是整个目录的性质，跟这份文件在哪毫无关系：`public/Downloads/`
 * 拼错时，`public/marketing/` 底下那份真正放错地方的报价单会被一起判成「已经在下载
 * 目录里」。
 *
 * 比的是顶层那一段，不是文件所在的那一层。要答的问题是「这条 URL 在不在 `/downloads/*`
 * 底下」，`/downloads/2026/quotation.pdf` 归不归 `/downloads/*` 管，只由第一段决定。
 *
 * `dev` 和 `ino` 要一起比：单看 `ino`，跨卷时两个不同的对象会撞号。替身只模一个卷，
 * 所以测试钉住的是 `ino` 那一半，`dev` 这一半没有测试守着——它是这个问法本来就该带
 * 的一半，不是为了过某条测试加的。
 *
 * 问不出来（stat 失败）时按「不在下载目录里」处理。多说一句建议，最坏是业主看到一句
 * 用不上的话；反过来吞掉，业主拿到的是一句无处下手的红字。
 */
function sitsInFoldedDownloadsDir(context, baseDir, servedPath) {
  const folded =
    resolveServedDirName(context, baseDir, DOWNLOADS_ASSET_SUBDIR).state ===
    "folded";
  if (!folded) return false;

  const parent = path.join(context.rootDir, baseDir);
  // 站点根上的文件不用另设守卫：`/quotation.pdf` 的第一段是文件名自己，而一个文件跟
  // 一个目录永远不是同一个对象，身份判据自己就答了否。
  const [, first = ""] = servedPath.split("/");
  const here = statOrError(
    context,
    path.join(parent, decodeURIComponent(first)),
  );
  const downloads = statOrError(
    context,
    path.join(parent, DOWNLOADS_ASSET_SUBDIR),
  );
  if (here.stats === undefined || downloads.stats === undefined) return false;
  return (
    here.stats.dev === downloads.stats.dev &&
    here.stats.ino === downloads.stats.ino
  );
}

/**
 * 不在受保护目录里的那些文档，判红时要多说一句「该怎么办」。
 *
 * 沿用原来那句的话，业主看到的是「/quotation.pdf in public/_headers is served
 * without ...」——`in public/_headers` 说的是被检查的那份规则文件，不是 PDF 在哪。
 * 对 `downloads/` 里的文件这句够用（动作就是去改 `_headers`），对这一类不够：真正
 * 要做的是把这份文件挪进 `public/downloads/`，而那句话一个字都没提。
 */
function collectStrayDocumentFailures(
  rules,
  relativePath,
  { path: targetPath, advise },
) {
  const failures = collectServedPathFailures(
    rules,
    relativePath,
    targetPath,
    EXPECTED_DOWNLOADS_NOINDEX,
  );
  if (!advise) return failures;
  return failures.map(
    (failure) =>
      `${failure}; it does not sit under downloads/, so either move it there or write a rule that covers it`,
  );
}

function collectServedPathFailures(
  rules,
  relativePath,
  targetPath,
  expectedHeader,
) {
  return listHeaderScopes(rules).flatMap((scopeHost) =>
    collectScopeFailures(
      rules,
      relativePath,
      targetPath,
      expectedHeader,
      scopeHost,
    ),
  );
}

/**
 * 域名段不是纯字面量的规则一律判红。
 *
 * 这里按域名分场景算，而场景就是规则里那串域名的**字面量**。域名段一旦含占位符或
 * 通配符，这个模型就塌了：`https://:h/downloads/*` 编译成 `(?<h>[^/.]+)`，只能匹配
 * 不带点的域名，真实域名全带点，所以它线上永远不生效；可场景串本身就是 `":h"`，
 * 不含点，被自己的模式一口吃下，于是它在每个场景里都把 noindex「补」了回来——三个
 * 场景全绿，而线上那份 PDF 一条 `X-Robots-Tag` 都没有。域名段带通配符的同理。
 *
 * 拿它拼响应头的值更是无从算起：`Cache-Control: :env` 的真实值等于真实域名的第一
 * 段，可能就是 `no-store`。
 *
 * 所以不猜，判红。当前 `public/_headers` 一条带域名的规则都没有，代价为零。
 */
function collectUnprovableHostFailures(rules, relativePath) {
  return rules
    .filter((rule) => {
      const matcher = ruleToMatcher(rule.path);
      if (matcher === null || matcher.host === null) return false;
      return matcher.hostPlaceholders.length > 0 || matcher.host.includes("*");
    })
    .map(
      (rule) =>
        `"${rule.path}" in ${relativePath} does not name one exact host, so which responses it reaches cannot be proven; write the host out in full`,
    );
}

/**
 * wrangler 的文本解析器接受的头名，运行时的 `Headers` 不一定接受。
 *
 * 它只拦下带空格的头名，`Bad@Name` 照样进 metadata；真正发资产时那句
 * `response.headers.set()` 抛异常，整个响应变成 500。2026-07-28 实测：给
 * `/downloads/*` 加一行 `Bad@Name: value` 之后，`wrangler dev --local` 上
 * `/downloads/spec-sheet-tb-bw.pdf` 返回 `500 Internal Server Error`。门禁却说这份
 * PDF 已经证明带着 noindex——它根本发不出来。撤销行同理，`headers.delete()` 也验名。
 *
 * 名和值要**分开探**。`Headers.set` 两样都验，一次探完只知道「这一行不行」，不知道
 * 是哪一半不行。曾经两种情况都印头名：值里夹一个回车（`trim()` 去不掉行内的 CR）时，
 * 门禁会说 `x-robots-tag` 不是运行时接受的头名——它当然是。业主拿着这句话只会去改
 * 头名，而坏的是值。
 */
function collectInvalidHeaderFailures(rules, relativePath) {
  const failures = [];
  const probe = new Headers();
  // 探值时用一个已知合法的头名，探名时用一个已知合法的值，这样抛出来的异常只可能
  // 来自被探的那一半。
  const PROBE_NAME = "x-probe";
  const PROBE_VALUE = "probe";

  for (const rule of rules) {
    for (const [name, value] of Object.entries(rule.headers)) {
      try {
        probe.set(name, PROBE_VALUE);
        probe.delete(name);
      } catch {
        failures.push(
          `"${name}" under "${rule.path}" in ${relativePath} is not a header name the runtime accepts, so every matching asset answers 500`,
        );
        continue;
      }
      try {
        probe.set(PROBE_NAME, value);
        probe.delete(PROBE_NAME);
      } catch {
        failures.push(
          `the value set for "${name}" under "${rule.path}" in ${relativePath} is not one the runtime accepts, so every matching asset answers 500`,
        );
      }
    }
    for (const unsetName of rule.unsetHeaders) {
      try {
        probe.delete(unsetName);
      } catch {
        failures.push(
          `"! ${unsetName}" under "${rule.path}" in ${relativePath} is not a header name the runtime accepts, so every matching asset answers 500`,
        );
      }
    }
  }

  return failures;
}

function collectHeaderFileFailures(
  context,
  relativePath,
  { downloadPaths, staticAssetPaths, strayDocumentPaths },
  isBuildOutput = false,
) {
  if (!repoFileExists(context, relativePath)) {
    const missing = isBuildOutput
      ? MISSING_BUILT_HEADER_FILE
      : MISSING_SOURCE_HEADER_FILE;
    return [`${missing}: ${relativePath}`];
  }

  const { text, code } = readRepoFileOrError(context, relativePath);
  if (text === undefined) {
    return [
      `${relativePath} could not be read (${code}), so nothing it says is proven`,
    ];
  }

  const rules = parseWranglerHeaderRules(text);

  // 查的是「一个真实路径最终被怎样服务」，不是「文件里有没有某一行」。
  //
  // 构建产物的缓存时长确实钉死在一年 immutable：那些文件名带内容哈希，改内容就
  // 换文件名，业主没有理由去调它。`/downloads/*` 和 `/images/*` 的缓存秒数不查
  // ——那两个是业主可调参数，钉死数字会让他一改就红而意图完全没坏。
  return [
    ...collectDuplicateRouteFailures(rules, relativePath),
    ...collectUnprovableHostFailures(rules, relativePath),
    ...collectInvalidHeaderFailures(rules, relativePath),
    ...staticAssetPaths.flatMap((assetPath) =>
      collectServedPathFailures(
        rules,
        relativePath,
        assetPath,
        `Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      ),
    ),
    ...downloadPaths.flatMap((downloadPath) =>
      collectServedPathFailures(
        rules,
        relativePath,
        downloadPath,
        EXPECTED_DOWNLOADS_NOINDEX,
      ),
    ),
    ...strayDocumentPaths.flatMap((document) =>
      collectStrayDocumentFailures(rules, relativePath, document),
    ),
  ];
}

function createCloudflareStaticAssetHeaderContext({
  rootDir = process.cwd(),
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  readdirSync = fs.readdirSync,
  statSync = fs.statSync,
} = {}) {
  return {
    rootDir,
    existsSync,
    readFileSync,
    readdirSync,
    statSync,
  };
}

/**
 * `assets` 底下这套检查没建模的键，各自意味着什么。
 *
 * 白名单，不是黑名单。列黑名单的话，wrangler 下次加一个键就是一个静默的假绿；
 * 列白名单，多出来的键会自己撞上。
 *
 * 但撞上之后说的话要分两种，不能一句话打包。wrangler 自己也有一份白名单
 * （cli.js:40198-40204），不在那份名单里的键它只往 warnings 里记一笔然后忽略
 * （cli.js 的 `validateAdditionalProperties`）。2026-07-28 实测：加一个
 * `"bogus_key_probe"` 之后 `wrangler dev --local` 照常起服务，响应头逐字不变。
 * 对着这种键说「它改变了资产怎么被发出去」是假的，而且方向正好反了——真实后果是
 * 业主本来想写的那个设置压根没生效。
 */
function describeUnmodelledAssetKeys(unmodelled) {
  const serving = [...unmodelled]
    .filter((key) => UNMODELLED_SERVING_ASSET_CONFIG_DEFAULTS.has(key))
    .sort();
  const ignored = [...unmodelled]
    .filter((key) => !UNMODELLED_SERVING_ASSET_CONFIG_DEFAULTS.has(key))
    .sort();

  const errors = [];
  if (serving.length > 0) {
    errors.push(
      `${WRANGLER_CONFIG_PATH} sets assets.${serving.join(", assets.")}, which changes how assets are served, and this check cannot model it`,
    );
  }
  if (ignored.length > 0) {
    errors.push(
      `${WRANGLER_CONFIG_PATH} sets assets.${ignored.join(", assets.")}, which wrangler does not recognise and ignores, so whatever it was meant to do is not happening`,
    );
  }
  return errors;
}

/**
 * 读出 wrangler 真正会发布哪个目录。
 *
 * 以前这里查的是 `wrangler.jsonc` 里有没有出现 `".open-next/assets"` 这串字符。
 * 那证明不了任何事：一条 `// old: ".open-next/assets"` 的注释就能让它过，而
 * `"directory"` 早就改成了别的目录——门禁去证明一个根本不会被发布的目录，线上那份
 * 真资产一个文件都没查。所以按 JSONC 解析取真实值，注释既满足不了它也绊不倒它。
 */
function readAssetsDirectories(context) {
  if (!repoFileExists(context, WRANGLER_CONFIG_PATH)) {
    return { errors: [`missing ${WRANGLER_CONFIG_PATH}`] };
  }

  const { text, code } = readRepoFileOrError(context, WRANGLER_CONFIG_PATH);
  if (text === undefined) {
    return {
      errors: [
        `${WRANGLER_CONFIG_PATH} could not be read (${code}), so this check cannot tell which files get published`,
      ],
    };
  }

  const { config, error } = ts.parseConfigFileTextToJson(
    WRANGLER_CONFIG_PATH,
    text,
  );
  if (error) {
    return { errors: [`${WRANGLER_CONFIG_PATH} could not be parsed`] };
  }

  // 命名环境可以覆盖 assets，而线上就是 `--env production` 发的
  // （.github/workflows/cloudflare-deploy.yml）。wrangler 的 `inheritable`
  // 是 `rawEnv[field] ?? topLevelEnv[field]`（cli.js:29494），环境里写了就以它为准。
  // 只读顶层的话，只要有人给 env.production 换个目录，门禁就在证明一个不会上线的
  // 目录。所有会被发布的目录逐个证明，一个都不放过。
  const directories = new Set();
  const unmodelled = new Set();
  for (const scope of [config, ...Object.values(config?.env ?? {})]) {
    const directory = scope?.assets?.directory;
    if (typeof directory === "string" && directory !== "") {
      directories.add(directory);
    }
    for (const [key, value] of Object.entries(scope?.assets ?? {})) {
      if (MODELLED_ASSET_CONFIG_KEYS.has(key)) continue;
      if (UNMODELLED_SERVING_ASSET_CONFIG_DEFAULTS.get(key) === value) continue;
      unmodelled.add(key);
    }
  }

  const errors = describeUnmodelledAssetKeys(unmodelled);
  if (errors.length > 0) return { errors };

  if (directories.size === 0) {
    return {
      errors: [
        `${WRANGLER_CONFIG_PATH} has no assets.directory, so this check cannot tell which files get published`,
      ],
    };
  }

  return { directories: [...directories] };
}

/**
 * `.html` 文件在 Workers Assets 上是从**去掉扩展名**的那条 URL 发出去的。
 *
 * 默认 `html_handling` 是 `auto-trailing-slash`：请求 `/downloads/x` 会直接返回
 * `/downloads/x.html` 的内容，而请求真实文件名 `/downloads/x.html` 反倒 307 跳到
 * `/downloads/x`。响应头按**请求里的原始路径**匹配，所以真正需要被证明的是
 * `/downloads/x`，而按磁盘文件名枚举出来的是 `/downloads/x.html`——两条不同的路径，
 * 一条落在别名上的撤销规则门禁完全看不见。
 *
 * 2026-07-28 实测：`.open-next/assets/downloads/alias-probe.pdf.html` 加上
 * `/downloads/alias-probe.pdf` + `! X-Robots-Tag` 之后，`/downloads/alias-probe.pdf`
 * 返回 200 和文件内容，响应里没有 `x-robots-tag`。
 *
 * 这里不去移植整套 `html_handling`（还有 `index.html`、结尾斜杠等好几种情形，而且
 * 它在 `wrangler.jsonc` 里可配）。受保护目录里今天一个 `.html` 都没有，所以直接判红
 * 并说清原因：真要发 HTML 下载，那时候再把这套别名规则老老实实移植进来。
 */
function collectHtmlAliasFailures(servedPaths, sourceDir) {
  return servedPaths
    .filter((servedPath) => servedPath.endsWith(".html"))
    .map(
      (servedPath) =>
        `${servedPath} in ${sourceDir} is served from its extensionless alias instead, and this check cannot prove that alias`,
    );
}

/**
 * 两个会改变「哪些文件、在哪条 URL 上被发出去」的资产根文件。有就判红。
 *
 * `_redirects` 里的 `200` 是重写不是跳转：另一条 URL 直接把受保护的文件发出去，
 * 而响应头按那条 URL 匹配，`/downloads/*` 底下的 noindex 根本不参与。2026-07-28
 * 实测：`/catalog-probe /downloads/spec-sheet-tb-bw.pdf 200` 之后，`/catalog-probe`
 * 返回 200 和真实 PDF，响应里没有 `x-robots-tag`。
 *
 * `.assetsignore` 决定哪些文件根本不上传（cli.js:124017）。整段 `/downloads/**`
 * 忽略掉之后，磁盘上 PDF 一个不少、门禁全绿，线上却全部 404。
 *
 * 这里不去半懂不懂地解析它们——占位符目标、百分号编码的目标、gitignore 通配，
 * 每一种都能绕开一个字符串扫描，上一版就是这么漏的。仓库当前两个文件都没有，
 * 所以直接判红并说清原因：真要用，那时候再把对应的解析器老老实实移植进来。
 */
function collectUnmodelledAssetFileFailures(context, directory) {
  return [ASSET_REDIRECTS_FILENAME, ASSET_ASSETSIGNORE_FILENAME]
    .map((filename) => `${directory}/${filename}`)
    .filter((relativePath) => repoFileExists(context, relativePath))
    .map(
      (relativePath) =>
        `${relativePath} changes which files are published and on which URLs, and this check cannot model it`,
    );
}

/**
 * 整棵已发布的树里，所有询盘物料类型的文件。
 *
 * 受保护目录那三次枚举回答的是「这个目录里的文件带没带对头」；这一次回答的是
 * 「有没有哪份文档根本不在受保护目录里」。少了它，门禁给出的保证是「downloads 这个
 * 目录里的文件带着 noindex」，而业主以为买到的是「我们的 PDF 带着 noindex」。
 *
 * 从根开始走，URL 前缀是空串——每一段路径都取自 readdir 的真实条目名，所以目录名
 * 大小写折叠在这里不成问题，算出来的就是线上那条 URL。
 *
 * 列不出来的目录照样要报。`public/foo` 打不开的时候，「它底下没有裸奔的 PDF」这句话
 * 是没有证据的。这些报错和受保护目录那三次枚举报的是同一句话，重复的在上层被去掉。
 */
function listPublishedDocuments(context, baseDir) {
  const listing = listServedPaths(context, baseDir, "");
  return {
    paths: listing.paths.filter(
      (servedPath) =>
        INDEXABLE_DOCUMENT_EXTENSIONS.has(
          path.extname(servedPath).toLowerCase(),
        ) && !isCrawlerFacing(servedPath),
    ),
    failures: listing.failures,
  };
}

function collectEmptyDirectoryFailure(
  paths,
  sourceDir,
  expectedHeader,
  isBuildOutput = false,
) {
  // null 表示这个目录压根没被数清楚，不是「数清楚了，是零」。前者已经有一句成立的
  // 话说明是什么问题了，在这里再补一句「里面没文件」是假的：它里面很可能满是文件。
  if (paths === null || paths.length > 0) return [];
  return [
    `${sourceDir} ${isBuildOutput ? HOLDS_NO_BUILT_FILES : HOLDS_NO_FILES}, so nothing proves "${expectedHeader}" reaches a real file`,
  ];
}

function collectPublishedDirectoryFailures(context, directory) {
  const assetHeadersPath = `${directory}/${ASSET_HEADERS_FILENAME}`;
  const assetDownloadsDir = `${directory}/${DOWNLOADS_ASSET_SUBDIR}`;
  const assetStaticDir = `${directory}/${STATIC_ASSET_SUBDIR}`;

  // 源目录和发布目录都要枚举。只查 `public/downloads` 的话，构建时才生成、只存在
  // 于发布目录里的 PDF 一份都没查过；只查发布目录的话，源码里新加的 PDF 要等下次
  // 构建才有人管。两边并起来，谁多出一份都得有人证明它带着 noindex。
  //
  // 目录名算不出来时一条路径都不列：拿写死的前缀继续算，出来的每一条结论说的都是
  // 一条线上不存在的 URL。这三个目录各判各的，一个算不出来不影响另外两个照常证明。
  const listResolved = (baseDir, urlSubdir) => {
    // 名字算不准就一条都不列，两种情形一样：折叠时按写死前缀算出来的 URL 线上不
    // 存在；上层列不出来时这个前缀对不对根本无从判断，而下层往往照样列得动，照算
    // 下去就是拿一条可能不存在的 URL 逐条下结论。判红的话已经由上面那句说清了。
    if (resolveServedDirName(context, baseDir, urlSubdir).state !== "exact") {
      return { paths: null, failures: [] };
    }
    const listing = listServedPaths(
      context,
      `${baseDir}/${urlSubdir}`,
      `/${urlSubdir}`,
    );
    // 一条路径都没列出来、同时又有东西没看成：这不是「空目录」。说它空是假的，
    // 而且会顺带勾出那句「先跑构建」——业主跑十遍构建也修不好一个权限问题。
    if (listing.paths.length === 0 && listing.failures.length > 0) {
      return { paths: null, failures: listing.failures };
    }
    return listing;
  };
  const sourceDownloads = listResolved(
    PUBLIC_SOURCE_DIR,
    DOWNLOADS_ASSET_SUBDIR,
  );
  const assetDownloads = listResolved(directory, DOWNLOADS_ASSET_SUBDIR);
  const staticAssets = listResolved(directory, STATIC_ASSET_SUBDIR);
  const sourceDownloadPaths = sourceDownloads.paths;
  const assetDownloadPaths = assetDownloads.paths;
  const staticAssetPaths = staticAssets.paths;
  const sourceDocuments = listPublishedDocuments(context, PUBLIC_SOURCE_DIR);
  const assetDocuments = listPublishedDocuments(context, directory);

  // 目录空了或者被改了名，逐文件证明就一条都不剩，而门禁会安安静静地全绿。
  // 这个仓库靠 PDF 接询盘，「没有可证明的东西」在这里就是失败。
  const failures = [
    // 「有一批文件根本没被列出来」必须有人说出来，靠空数组表示等于静默放过。
    ...sourceDownloads.failures,
    ...assetDownloads.failures,
    ...staticAssets.failures,
    ...sourceDocuments.failures,
    ...assetDocuments.failures,
    ...collectEmptyDirectoryFailure(
      sourceDownloadPaths,
      DOWNLOADS_SOURCE_DIR,
      EXPECTED_DOWNLOADS_NOINDEX,
    ),
    // 源目录本身就是空的时候，构建产物那边空是必然的，再说一遍只会多勾出一句
    // 「先跑构建」——业主跑一百遍也变不绿，因为根因在源目录。源目录那句已经说清了。
    ...(sourceDownloadPaths?.length === 0
      ? []
      : collectEmptyDirectoryFailure(
          assetDownloadPaths,
          assetDownloadsDir,
          EXPECTED_DOWNLOADS_NOINDEX,
          true,
        )),
    ...collectEmptyDirectoryFailure(
      staticAssetPaths,
      assetStaticDir,
      `Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      true,
    ),
    ...collectUnresolvedDirectoryFailures(
      context,
      PUBLIC_SOURCE_DIR,
      DOWNLOADS_ASSET_SUBDIR,
    ),
    ...collectUnresolvedDirectoryFailures(
      context,
      directory,
      DOWNLOADS_ASSET_SUBDIR,
    ),
    ...collectUnresolvedDirectoryFailures(
      context,
      directory,
      STATIC_ASSET_SUBDIR,
    ),
    // 一个磁盘文件被发出去的 URL 不一定只有它自己那条。这两类别名会让被证明的
    // 路径和实际被请求的路径对不上，所以直接判红。
    ...collectHtmlAliasFailures(
      sourceDownloadPaths ?? [],
      DOWNLOADS_SOURCE_DIR,
    ),
    ...collectHtmlAliasFailures(assetDownloadPaths ?? [], assetDownloadsDir),
    ...collectHtmlAliasFailures(staticAssetPaths ?? [], assetStaticDir),
    ...collectUnmodelledAssetFileFailures(context, directory),
    ...collectUnmodelledAssetFileFailures(context, PUBLIC_SOURCE_DIR),
  ];

  const downloadPaths = [
    ...new Set([...(sourceDownloadPaths ?? []), ...(assetDownloadPaths ?? [])]),
  ].sort();
  // 已经被受保护目录那两次枚举证明过的不重复算：同一个文件说两遍，第二遍还带着
  // 「把它挪进 downloads/」，而它本来就在里面。
  const servedPaths = {
    downloadPaths,
    staticAssetPaths: staticAssetPaths ?? [],
    // 「把它挪进 downloads/」这句只在它成立时才说。这份文件所在的目录就是下载目录、
    // 只是名字被文件系统折叠了的时候，它已经在里面了，真正的动作是改目录名——而那句
    // 话已经由 `collectUnresolvedDirectoryFailures` 说了。
    //
    // 判据是「这条 URL 的顶层那一段，是不是那个名字被折叠了的下载目录」，逐份问磁盘。
    // 两侧的目录树不一样，所以两侧各问一次。
    strayDocumentPaths: [
      ...new Set([...sourceDocuments.paths, ...assetDocuments.paths]),
    ]
      .filter((documentPath) => !downloadPaths.includes(documentPath))
      .sort()
      .map((documentPath) => ({
        path: documentPath,
        advise: ![PUBLIC_SOURCE_DIR, directory].some((baseDir) =>
          sitsInFoldedDownloadsDir(context, baseDir, documentPath),
        ),
      })),
  };
  failures.push(
    ...collectHeaderFileFailures(context, SOURCE_HEADERS_PATH, servedPaths),
    ...collectHeaderFileFailures(context, assetHeadersPath, servedPaths, true),
  );

  return failures;
}

function collectCloudflareStaticAssetHeaderFailures(options = {}) {
  const context = createCloudflareStaticAssetHeaderContext(options);
  const { directories, errors } = readAssetsDirectories(context);
  // 不知道发布哪个目录就什么都证明不了。这里直接停，不拿写死的目录顶上——那正是
  // 上一版的假绿来源。
  if (errors !== undefined) return errors;

  // 同一个目录被多个环境用到时，重复的报错去掉，说的是同一件事。
  const failures = new Set();
  for (const directory of directories) {
    for (const failure of collectPublishedDirectoryFailures(
      context,
      directory,
    )) {
      failures.add(failure);
    }
  }

  return [...failures];
}

function runCloudflareStaticAssetHeaderCli(options = {}) {
  const failures = collectCloudflareStaticAssetHeaderFailures(options);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`Cloudflare static asset header check failed: ${failure}`);
    }
    const needsBuild = failures.some(
      (failure) =>
        failure.startsWith(MISSING_BUILT_HEADER_FILE) ||
        failure.includes(` ${HOLDS_NO_BUILT_FILES},`),
    );
    if (needsBuild) {
      console.error(
        "Run `pnpm build` then `pnpm website:build:cf` before this artifact check.",
      );
    }
    return false;
  }

  console.log(
    "Cloudflare static asset headers are present in source and OpenNext output.",
  );
  return true;
}

module.exports = {
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
  SOURCE_HEADERS_PATH,
  collectCloudflareStaticAssetHeaderFailures,
  createCloudflareStaticAssetHeaderContext,
  runCloudflareStaticAssetHeaderCli,
};
