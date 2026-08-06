import path from "node:path";

import {
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

// 一份合法夹具会写的两条路由。门禁**不要求**它们存在：换成别的写法，只要每个真实
// 文件最终都拿到期望的头，它一样绿。所以这两个常量属于夹具，不属于门禁——放在门禁
// 里导出会让人以为那是它强制的路由。
export const EXPECTED_STATIC_ASSET_HEADER_ROUTE = "/_next/static/*";
export const EXPECTED_DOWNLOADS_HEADER_ROUTE = "/downloads/*";

export const ROOT_DIR = "/repo";
/** 替身只有一个卷，所以 `statSync` 报的 `dev` 是个常数。 */
const VIRTUAL_DEVICE_ID = 1;
export const ASSETS_DIR = ".open-next/assets";
export const DOWNLOADS_DIR = "public/downloads";
// 真正被发布出去的是资产目录，源目录只是下次构建的输入。两个都要有夹具，否则
// 「只存在于构建产物里的 PDF」这个场景根本测不出来。
export const BUILT_DOWNLOADS_DIR = `${ASSETS_DIR}/downloads`;
export const STATIC_DIR = `${ASSETS_DIR}/_next/static`;
export const CATALOG_PATH = "/downloads/catalog.pdf";
// 构建产物的文件名全带内容哈希，没有 main.js 这种固定名字。写死一条不存在的探针
// 路径等于什么都没证明：撤销落在真实哈希文件上时它毫无反应。
export const BUNDLE_NAME = "2huo56-xai-ru.js";
export const BUNDLE_PATH = `/_next/static/chunks/${BUNDLE_NAME}`;

/**
 * 虚拟仓库。两份测试共用：一份守门禁要证明什么，一份守移植过来的 wrangler 语义。
 */
/**
 * 文件系统怎么把「查的名字」折叠成「磁盘上的名字」。默认不折叠（Linux）。
 *
 * macOS 默认的 APFS 会折叠，而且折叠表比 JS 的大小写表大：本机实测 `ſ`（U+017F）
 * 在磁盘上等于 `s`，但 `"ſ".toLowerCase()` 还是 `"ſ"`。所以这里给的是一个函数而不是
 * 一个开关——门禁不该依赖 JS 的大小写规则，测试要能证明这一点。
 * 折叠只作用在按名字查（existsSync / readFileSync / statSync）上；readdirSync 永远
 * 报磁盘上的真名，跟真实 fs 一致。
 */
export interface VirtualRepoOptions {
  /** 这些路径在 readdir 里是符号链接。只进这张表不进文件表就是断链。 */
  symlinks?: Set<string>;
  /**
   * 能走通的符号链接：路径到它指向的路径。`statSync` 跟随链接，所以链接和目标是磁盘
   * 上的同一个对象，`ino` 相同——真实 fs 就是这样，而门禁靠这个数判「这两条路径是不是
   * 同一个目录」。只有 `symlinks` 那张表的话，替身里的链接永远是断链，「别名」这一整
   * 类场景在测试里根本摆不出来。只解析一层，够用就好。
   */
  symlinkTargets?: Map<string, string>;
  /** 文件系统怎么把「查的名字」折叠成「磁盘上的名字」，默认不折叠。 */
  fold?: (name: string) => string;
  /** readdir 抛 EACCES 的目录。 */
  unlistable?: Set<string>;
  /**
   * statSync 抛指定错误码的路径。给的是路径到错误码的表而不是一个集合：目录权限
   * 444 时 readdir 成功、对每个孩子 stat 抛 EACCES，断链则是抛 ENOENT，这两档的
   * 正确处置正好相反。
   */
  unstattable?: Map<string, string>;
  /**
   * 既不是普通文件也不是目录：FIFO、socket、设备节点。wrangler 只排掉目录和符号
   * 链接（cli.js:137583），这一档它照传，所以门禁必须证明它。只有 isFile/isDirectory
   * 两个互补判据的替身永远造不出这一档，那个守卫就没人守得住。
   */
  irregular?: Set<string>;
  /** readFileSync 抛指定错误码的路径。`existsSync` 说「在」不等于读得出来。 */
  unreadable?: Map<string, string>;
}

export function createVirtualRepo(
  files: Record<string, string>,
  {
    symlinks = new Set<string>(),
    symlinkTargets = new Map<string, string>(),
    fold = (name: string) => name,
    unlistable = new Set<string>(),
    unstattable = new Map<string, string>(),
    irregular = new Set<string>(),
    unreadable = new Map<string, string>(),
  }: VirtualRepoOptions = {},
) {
  // 目录也要能被折叠命中，所以每个 key 的每一层祖先都进表。
  const folded = new Map<string, string>();
  for (const key of Object.keys(files)) {
    const segments = key.split("/");
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const ancestor = segments.slice(0, depth).join("/");
      if (!folded.has(fold(ancestor))) folded.set(fold(ancestor), ancestor);
    }
  }
  // 同一个磁盘对象的编号。折叠之后两个不同的查名会归一到同一个 key，于是它们拿到
  // 同一个 `ino`——真实文件系统就是这么回答「这两条路径是不是同一个目录」的，本机
  // APFS 实测 `public/downloads` 和磁盘真名 `public/Downloads` 的 `dev:ino` 相同。
  // 替身不模这一层的话，门禁靠身份而不是靠名字做的判断在测试里根本分不出对错。
  const inodes = new Map<string, number>();
  const inodeOf = (key: string) => {
    if (!inodes.has(key)) inodes.set(key, inodes.size + 1);
    return inodes.get(key) as number;
  };
  const follow = (key: string) => {
    for (const [link, target] of symlinkTargets) {
      if (key === link) return target;
      if (key.startsWith(`${link}/`))
        return `${target}${key.slice(link.length)}`;
    }
    return key;
  };
  const normalize = (absolutePath: string) => {
    const raw = path.relative(ROOT_DIR, absolutePath).split(path.sep).join("/");
    const key = follow(raw);
    if (files[key] !== undefined) return key;
    return folded.get(fold(key)) ?? key;
  };
  // 根目录归一化后是空串，拼前缀时不能再补 `/`——补了就成了 `/`，一个 key 都匹配
  // 不上，`readdirSync(rootDir)` 会返回空数组。真实 fs 在根目录上列得出东西。
  const childPrefix = (absolutePath: string) => {
    const key = normalize(absolutePath);
    return key === "" ? "" : `${key}/`;
  };

  return {
    rootDir: ROOT_DIR,
    // 目录也要认。门禁先问 public/downloads 在不在，再列它——只认文件的话
    // 目录永远"不存在"，逐文件证明一条都跑不起来。
    existsSync: (absolutePath: string) => {
      const key = normalize(absolutePath);
      return (
        files[key] !== undefined ||
        Object.keys(files).some((name) => name.startsWith(`${key}/`))
      );
    },
    readFileSync: (absolutePath: string) => {
      const key = normalize(absolutePath);
      // 真实 fs 读不出来时抛的是带 `code` 的异常。替身只会抛裸 Error 的话，
      // 「读不出来要报成失败而不是崩溃」这条根本测不出来。
      const forced = unreadable.get(key);
      if (forced !== undefined) {
        const error: NodeJS.ErrnoException = new Error(`${forced}: '${key}'`);
        error.code = forced;
        throw error;
      }
      const content = files[key];
      if (content === undefined) {
        throw new Error(`Missing virtual file: ${key}`);
      }
      return content;
    },
    // 返回 Dirent 形状，和真实 readdirSync(dir, { withFileTypes: true }) 一致。
    // 替身只返回字符串的话，「目录不算文件」这条根本没法被测出来。
    readdirSync: (absolutePath: string) => {
      const key = normalize(absolutePath);
      // 真实 fs 列不出来时是抛带 `code` 的异常，不是返回空数组。门禁靠 `code` 区分
      // 「目录不在」（ENOENT/ENOTDIR，没有可证明的东西）和「列不出来」（EACCES 等，
      // 有一批文件没被证明过）——替身只会返回空数组的话，这两件相反的事在测试里
      // 根本分不开，而它们的正确处置也正好相反。
      const fail = (code: string) => {
        const error: NodeJS.ErrnoException = new Error(`${code}: '${key}'`);
        error.code = code;
        throw error;
      };
      if (unlistable.has(key)) fail("EACCES");
      if (files[key] !== undefined) fail("ENOTDIR");
      const prefix = childPrefix(absolutePath);
      if (
        key !== "" &&
        !Object.keys(files).some((name) => name.startsWith(prefix))
      ) {
        fail("ENOENT");
      }
      const child = (name: string) =>
        name.slice(prefix.length).split("/")[0] as string;
      const names = new Set([
        ...Object.keys(files)
          .filter((name) => name.startsWith(prefix))
          .map(child),
        // 断链：readdir 列得出名字，磁盘上却没有目标，statSync 才抛 ENOENT。
        // 只从 files 推名字的话这一档根本造不出来。
        ...[...symlinks].filter((link) => link.startsWith(prefix)).map(child),
        // 能走通的链接同理：目标底下的文件不带这个名字，只能从这张表里来。
        ...[...symlinkTargets.keys()]
          .filter((link) => link.startsWith(prefix))
          .map(child),
      ]);
      return [...names].map((name) => {
        const linked =
          symlinks.has(`${prefix}${name}`) ||
          symlinkTargets.has(`${prefix}${name}`);
        const isDirectory = Object.keys(files).some((file) =>
          file.startsWith(`${prefix}${name}/`),
        );
        return {
          name,
          // Dirent 看到的是链接本身，所以符号链接既不是目录也不是普通文件。
          // 跟随之后是什么，由 statSync 回答——wrangler 也是这么分工的。
          isDirectory: () => isDirectory && !linked,
          isFile: () => !isDirectory && !linked,
        };
      });
    },
    // statSync 跟随符号链接：指向真实文件的链接在这里就是普通文件，指向目录的
    // 链接就是目录。门禁靠它决定要不要递归，所以两个判据都要有。
    statSync: (absolutePath: string) => {
      const key = normalize(absolutePath);
      // readdirSync 一样，失败要带 `code`。「不在了」（ENOENT，断链，没什么可证明）
      // 和「看不了」（EACCES，这个条目是目录还是 PDF 都不知道）处置完全相反。
      const fail = (code: string) => {
        const error: NodeJS.ErrnoException = new Error(`${code}: '${key}'`);
        error.code = code;
        throw error;
      };
      const forced = unstattable.get(key);
      if (forced !== undefined) fail(forced);
      const isDirectory = Object.keys(files).some((file) =>
        file.startsWith(`${key}/`),
      );
      if (!isDirectory && files[key] === undefined) fail("ENOENT");
      // 整个替身就是一个卷，`dev` 是常数。真实 fs 上跨卷时 `ino` 会撞，所以门禁两个
      // 都比；这里给个固定值，让那份代码在替身上跑的是同一条路径。
      const identity = { dev: VIRTUAL_DEVICE_ID, ino: inodeOf(key) };
      if (irregular.has(key)) {
        return { ...identity, isFile: () => false, isDirectory: () => false };
      }
      return {
        ...identity,
        isFile: () => !isDirectory,
        isDirectory: () => isDirectory,
      };
    },
  };
}

export function createValidFiles(): Record<string, string> {
  const headers = [
    EXPECTED_STATIC_ASSET_HEADER_ROUTE,
    `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
    "",
    EXPECTED_DOWNLOADS_HEADER_ROUTE,
    `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
    "  Cache-Control: public,max-age=86400",
    "",
  ].join("\n");

  return {
    "public/_headers": headers,
    ".open-next/assets/_headers": headers,
    // 两个文件而不是一个：证明的是"每个真实发布的 PDF"，不是"某一条写死的路径"。
    [`${DOWNLOADS_DIR}/catalog.pdf`]: "%PDF-1.7",
    [`${DOWNLOADS_DIR}/spec-sheet.pdf`]: "%PDF-1.7",
    // 构建把它们复制进资产目录，那份才是真正被发布的。
    [`${BUILT_DOWNLOADS_DIR}/catalog.pdf`]: "%PDF-1.7",
    [`${BUILT_DOWNLOADS_DIR}/spec-sheet.pdf`]: "%PDF-1.7",
    // 静态资源同理，逐个真实 bundle 求最终响应头。
    [`${STATIC_DIR}/chunks/${BUNDLE_NAME}`]: "console.log(1)",
    [`${STATIC_DIR}/media/logo.svg`]: "<svg />",
    "wrangler.jsonc": [
      "{",
      '  "assets": {',
      '    "directory": ".open-next/assets"',
      "  }",
      "}",
      "",
    ].join("\n"),
  };
}
