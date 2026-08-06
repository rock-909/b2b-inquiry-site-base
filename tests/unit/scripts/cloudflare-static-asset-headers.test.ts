import { describe, expect, it, vi } from "vitest";
import {
  collectCloudflareStaticAssetHeaderFailures,
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
  runCloudflareStaticAssetHeaderCli,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

import {
  ASSETS_DIR,
  BUILT_DOWNLOADS_DIR,
  BUNDLE_PATH,
  CATALOG_PATH,
  createValidFiles,
  createVirtualRepo,
  DOWNLOADS_DIR,
  EXPECTED_DOWNLOADS_HEADER_ROUTE,
  EXPECTED_STATIC_ASSET_HEADER_ROUTE,
} from "./cloudflare-headers-fixtures";

// 这份守的是门禁要证明什么：每个真实 PDF 拿到 noindex，每个真实 bundle 拿到一年
// immutable 缓存，哪些等价写法不该被判红，以及判红时那句行动建议成不成立。
//
// 这一套一共六份，各守一段：
// - cloudflare-headers-published-surface：哪些文件会被发布出去
// - cloudflare-headers-directory-resolution：受保护目录在磁盘上叫什么、看不看得了
// - cloudflare-headers-rule-rejection：wrangler 会把哪些规则整条丢掉
// - cloudflare-headers-wrangler-semantics：留下来的规则怎么编译、怎么命中
// - cloudflare-headers-effective-value：命中之后一个文件最终拿到什么值
describe("Cloudflare static asset headers proof", () => {
  it("keeps the cache and crawl policy it exists to enforce", () => {
    // 其余每一条断言的期望值都是从这两个常量拼出来的，所以它们只证明「实现和自己的
    // 常量一致」。把常量削掉 `immutable`，真实 `_headers` 是超集、门禁照样全绿，
    // 没有一条会红——策略本身必须单独钉住。
    expect(EXPECTED_STATIC_ASSET_CACHE_CONTROL).toContain("max-age=31536000");
    expect(EXPECTED_STATIC_ASSET_CACHE_CONTROL).toContain("immutable");
    expect(EXPECTED_DOWNLOADS_NOINDEX.toLowerCase()).toContain("noindex");
  });

  it("accepts matching source and OpenNext asset headers", () => {
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(createValidFiles()),
    );

    expect(failures).toEqual([]);
  });

  it("requires the OpenNext asset output to contain _headers", () => {
    const files = createValidFiles();
    delete files[".open-next/assets/_headers"];

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toContain(
      "missing Cloudflare build output header file: .open-next/assets/_headers",
    );
  });

  it("requires the asset output cache rule to match the source rule", () => {
    const files = {
      ...createValidFiles(),
      ".open-next/assets/_headers": [
        EXPECTED_STATIC_ASSET_HEADER_ROUTE,
        "  Cache-Control: public,max-age=60",
        "",
      ].join("\n"),
    };

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toContain(
      `${BUNDLE_PATH} in .open-next/assets/_headers does not carry "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}"`,
    );
  });

  it("fails when a real bundle has its cache rule detached", () => {
    // 撤销可以精确落在某个真实哈希文件上。以前探的是写死的
    // `/_next/static/chunks/main.js`，那个文件在构建产物里根本不存在，于是这条
    // 撤销线上生效、bundle 失去一年缓存，而门禁全绿。
    const detached = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      BUNDLE_PATH,
      "  ! Cache-Control",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": detached,
        ".open-next/assets/_headers": detached,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("fails when a bundle rule appends a directive that kills the cache", () => {
    // wrangler 用 append 拼接同名头，指令是并起来的。通配块给了一年 immutable、
    // 精确规则再追加 no-store，三个期望 token 一个不少，而那个文件线上一秒都不会
    // 被缓存。只看「要的指令都在」就会在这里假绿。
    const killed = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      BUNDLE_PATH,
      "  Cache-Control: no-store",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": killed,
        ".open-next/assets/_headers": killed,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store overrides it`,
      ),
    );
  });

  it("fails when a bundle rule appends a second, shorter max-age", () => {
    // 同时挂着两个时长，线上按哪个算是不确定的，同样不能算「缓存一年」的证明。
    const shortened = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      BUNDLE_PATH,
      "  Cache-Control: max-age=0",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": shortened,
        ".open-next/assets/_headers": shortened,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but max-age=0 sits beside it, so which one applies cannot be proven`,
      ),
    );
  });

  it("fails when the downloads block is missing from the source header file", () => {
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers":
          "/_next/static/*\n  Cache-Control: public,max-age=31536000,immutable\n",
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("fails when the built artifact lost the pdf noindex rule", () => {
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        ".open-next/assets/_headers":
          "/_next/static/*\n  Cache-Control: public,max-age=31536000,immutable\n\n/downloads/*\n  Cache-Control: public,max-age=86400\n",
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in .open-next/assets/_headers is served without`,
      ),
    );
  });

  it("fails when noindex sits in another route block instead of downloads", () => {
    // 全文件查字符串会在这里假绿：两个子串都还在文件里，但 PDF 已经能被收录。
    const misplaced = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  Cache-Control: public,max-age=86400",
      "",
      "/images/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": misplaced,
        ".open-next/assets/_headers": misplaced,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in .open-next/assets/_headers is served without`,
      ),
    );
  });

  it("fails when noindex only sits under an absolute-URL route line", () => {
    // 带域名的规则只对那一个域名生效，而这里不知道线上会用哪个域名（预览域名
    // 就是另一个）。拿它当证明就是假绿：PDF 在实际域名上照样能被收录。
    const domainScoped = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  Cache-Control: public,max-age=86400",
      "",
      "https://tucsenberg.com/downloads/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": domainScoped,
        ".open-next/assets/_headers": domainScoped,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("passes when the same headers use HTTP-standard spacing", () => {
    // `public, max-age=86400` 和 `public,max-age=86400` 是同一条头。业主重排一次
    // 格式就变红，是门禁在说谎，不是意图坏了。
    const spaced = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "  Cache-Control: public, max-age=86400",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": spaced,
        ".open-next/assets/_headers": spaced,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("fails when the noindex value itself is misspelled with a space", () => {
    // 抹平空格只该抹分隔符两侧的。`no index` 不是 `noindex`，Google 不认，
    // PDF 照样被收录——这条必须红。
    const misspelled = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag: no index",
      "  Cache-Control: public,max-age=86400",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": misspelled,
        ".open-next/assets/_headers": misspelled,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers does not carry "${EXPECTED_DOWNLOADS_NOINDEX}"`,
      ),
    );
  });

  it("passes when the noindex rule is strengthened with more directives", () => {
    // `noindex, nofollow` 比只写 noindex 更严。门禁不能拦着业主加强防护——
    // 一个逼人不许改好的检查，该改的是检查。
    const stronger = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag: noindex, nofollow",
      "  Cache-Control: public,max-age=86400",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": stronger,
        ".open-next/assets/_headers": stronger,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("passes when the noindex rule is written as the equivalent none", () => {
    // Google 定义 `none` 等于 `noindex, nofollow`，比只写 noindex 更严。
    // 把它判红等于逼着业主改弱防护。
    const none = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag: none",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": none,
        ".open-next/assets/_headers": none,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("fails when noindex only applies to one named crawler", () => {
    // Google 的写法是 `<爬虫名>: <指令>[, <指令>…]`，爬虫名后面那一整串都只属于
    // 那个爬虫。只按逗号拆的话，`bingbot: nosnippet, noindex` 里的 noindex 会被当成
    // 全局指令，而 Googlebot 收到的那一行对它一条都不生效，PDF 照样被收录。
    const scoped = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag: bingbot: nosnippet, noindex",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": scoped,
        ".open-next/assets/_headers": scoped,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers does not carry "${EXPECTED_DOWNLOADS_NOINDEX}"`,
      ),
    );
  });

  it("fails when a cache-killing directive carries a parameter", () => {
    // 客户端按 name=value 取名字，`no-store=1` 的名字就是 no-store，浏览器照样不
    // 缓存。只比整词的话加个 `=1` 就绕过去了。
    const parameterised = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      BUNDLE_PATH,
      "  Cache-Control: no-store=1",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": parameterised,
        ".open-next/assets/_headers": parameterised,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store=1 overrides it`,
      ),
    );
  });

  it("fails when private or no-cache overrides the one-year cache", () => {
    // no-store 之外的两个同样会让「缓存一年」这句话不成立，名单少一个就漏一个。
    for (const directive of ["no-cache", "private"]) {
      const overridden = [
        EXPECTED_STATIC_ASSET_HEADER_ROUTE,
        `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
        "",
        BUNDLE_PATH,
        `  Cache-Control: ${directive}`,
        "",
        EXPECTED_DOWNLOADS_HEADER_ROUTE,
        `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
        "",
      ].join("\n");

      const failures = collectCloudflareStaticAssetHeaderFailures(
        createVirtualRepo({
          ...createValidFiles(),
          "public/_headers": overridden,
          ".open-next/assets/_headers": overridden,
        }),
      );

      expect(failures).toContainEqual(
        expect.stringContaining(
          `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but ${directive} overrides it`,
        ),
      );
    }
  });

  it("fails when a shorter s-maxage sits beside the expected max-age", () => {
    const shorterShared = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      BUNDLE_PATH,
      "  Cache-Control: s-maxage = 0",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": shorterShared,
        ".open-next/assets/_headers": shorterShared,
      }),
    );

    // 等号两侧的空格也要抹平，否则换个写法就绕过冲突检测。
    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but s-maxage=0 sits beside it, so which one applies cannot be proven`,
      ),
    );
  });

  it("fails when a header name the runtime rejects would break the response", () => {
    // wrangler 的文本解析器只拦带空格的头名。`Bad@Name` 进得去，发资产时
    // `headers.set()` 抛异常，整个响应 500——那份 PDF 根本发不出来。
    const invalid = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "  Bad@Name: value",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": invalid,
        [`${ASSETS_DIR}/_headers`]: invalid,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        '"bad@name" under "/downloads/*" in public/_headers is not a header name the runtime accepts',
      ),
    );
  });

  it("blames the value, not the name, when the value is what breaks", () => {
    // `Headers.set` 名和值一起验。一次探完只知道这一行不行，不知道坏的是哪一半。
    // 值里夹一个行内回车（`trim()` 去不掉）时，曾经印的是「x-robots-tag 不是运行时
    // 接受的头名」——它当然是。业主拿着这句话只会去改头名，而坏的是值。
    const badValue = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}\revil`,
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": badValue,
        [`${ASSETS_DIR}/_headers`]: badValue,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        'the value set for "x-robots-tag" under "/downloads/*" in public/_headers is not one the runtime accepts',
      ),
    );
    // 而且不能同时又说头名不行。同一行只有一个毛病。
    expect(failures.join("\n")).not.toContain(
      '"x-robots-tag" under "/downloads/*" in public/_headers is not a header name',
    );
  });

  it("refuses to model an assets setting it does not understand", () => {
    // `assets` 底下每多一个键都可能改变「哪个文件从哪条 URL 发出去」，或者
    // `_headers` 还算不算数。`html_handling: "none"` 实测下 `/x.pdf.html` 返回 200、
    // `/x.pdf` 是 404，整套 `.html` 别名的说法当场作废；`run_worker_first` 更彻底，
    // 请求整个交给 Worker，这份门禁的每一条结论都不成立。
    const files = createValidFiles();
    files["wrangler.jsonc"] = [
      "{",
      '  "assets": {',
      '    "directory": ".open-next/assets",',
      '    "html_handling": "none"',
      "  }",
      "}",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toEqual([
      "wrangler.jsonc sets assets.html_handling, which changes how assets are served, and this check cannot model it",
    ]);
  });

  it("lets a serving key through when it is written at its default value", () => {
    // `"html_handling": "auto-trailing-slash"` 就是 wrangler 的默认值
    // （assets.worker.js:7962）。把默认值显式写出来是很常见的写法，线上一个字节都不
    // 会变。对它判红并说「它改变了资产怎么被发出去」是假话，而误红会让业主学会绕过
    // 整道门禁。
    const files = createValidFiles();
    files["wrangler.jsonc"] = [
      "{",
      '  "assets": {',
      '    "directory": ".open-next/assets",',
      '    "html_handling": "auto-trailing-slash",',
      '    "not_found_handling": "none",',
      '    "run_worker_first": false',
      "  }",
      "}",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toEqual([]);
  });

  it("says a key wrangler ignores is being ignored, not that it cannot be modelled", () => {
    // wrangler 4.100.0 只认 `assets` 底下那五个键（cli.js:40198-40204），别的原样丢进
    // 警告里、当不存在。所以这一档和上一档是两件事：上一档那个键真的在改变发布行为，
    // 这一档那个键**什么都没做**。合成一句「这套检查建模不了」是假的，业主会去查
    // 门禁怎么不支持，而真相是他写的那行配置线上根本没生效。
    const files = createValidFiles();
    files["wrangler.jsonc"] = [
      "{",
      '  "assets": {',
      '    "directory": ".open-next/assets",',
      '    "serve_directly": false',
      "  }",
      "}",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toEqual([
      "wrangler.jsonc sets assets.serve_directly, which wrangler does not recognise and ignores, so whatever it was meant to do is not happening",
    ]);
  });

  it("reports instead of crashing when the wrangler config cannot be read", () => {
    // 和 `_headers` 那条同一个道理，但少了它整套结论都没有落点：读不出
    // `wrangler.jsonc` 就不知道哪个目录会被发布，一个文件都证明不了。这句话必须说
    // 「这套检查没法知道」，不能说成线上出了问题——业主拿着一句「no way to tell」
    // 会以为是站点坏了，实际要做的只是修一个本机权限。
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(createValidFiles(), {
        unreadable: new Map([["wrangler.jsonc", "EACCES"]]),
      }),
    );

    expect(failures).toEqual([
      "wrangler.jsonc could not be read (EACCES), so this check cannot tell which files get published",
    ]);
  });

  it("reports instead of crashing when a header file cannot be read", () => {
    // `existsSync` 说「在」和「读得出来」是两件事。直接 readFileSync 的话，权限不对
    // 时门禁变成崩溃：业主看到一段堆栈，一句失败都没有，而 CI 上这和「检查真的跑过
    // 并且通过了」长得完全不一样。
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(createValidFiles(), {
        unreadable: new Map([["public/_headers", "EACCES"]]),
      }),
    );

    expect(failures).toEqual([
      "public/_headers could not be read (EACCES), so nothing it says is proven",
    ]);
  });

  // 判红时唯一那句行动建议必须成立。只有构建产物那一侧的失败才该指向「先跑构建」；
  // git 跟踪的源文件坏了，构建一万次也是同一条红，把业主指过去等于让他白等 20 分钟。
  const buildHintCases = [
    {
      name: "a duplicated route",
      hint: "does not tell",
      break: (files: Record<string, string>) => {
        const duplicated = [
          EXPECTED_STATIC_ASSET_HEADER_ROUTE,
          `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
          "",
          EXPECTED_DOWNLOADS_HEADER_ROUTE,
          `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
          "",
          EXPECTED_DOWNLOADS_HEADER_ROUTE,
          "  Cache-Control: public,max-age=86400",
          "",
        ].join("\n");
        files["public/_headers"] = duplicated;
        files[`${ASSETS_DIR}/_headers`] = duplicated;
      },
    },
    {
      name: "a deleted source _headers",
      hint: "does not tell",
      break: (files: Record<string, string>) => delete files["public/_headers"],
    },
    {
      name: "an emptied source downloads directory",
      hint: "does not tell",
      break: (files: Record<string, string>) => {
        delete files[`${DOWNLOADS_DIR}/catalog.pdf`];
        delete files[`${DOWNLOADS_DIR}/spec-sheet.pdf`];
      },
    },
    {
      name: "a missing built _headers",
      hint: "tells",
      break: (files: Record<string, string>) =>
        delete files[`${ASSETS_DIR}/_headers`],
    },
    {
      name: "an emptied built downloads directory",
      hint: "tells",
      break: (files: Record<string, string>) => {
        delete files[`${BUILT_DOWNLOADS_DIR}/catalog.pdf`];
        delete files[`${BUILT_DOWNLOADS_DIR}/spec-sheet.pdf`];
      },
    },
    {
      // 源目录空了，构建产物那边空是必然的。这时候「先跑构建」同样是句废话：根因在
      // 源目录，跑一百遍也变不绿。业主重命名了 downloads 目录时撞的就是这条。
      name: "both downloads directories emptied at once",
      hint: "does not tell",
      break: (files: Record<string, string>) => {
        for (const name of ["catalog.pdf", "spec-sheet.pdf"]) {
          delete files[`${DOWNLOADS_DIR}/${name}`];
          delete files[`${BUILT_DOWNLOADS_DIR}/${name}`];
        }
      },
    },
    {
      // 目录里满是文件，只是列不出来。这时候「先跑构建」是句废话：业主跑十遍也
      // 修不好一个权限问题，而真正该看的那行被埋在这句提示下面。
      name: "a built downloads directory that cannot be listed",
      hint: "does not tell",
      break: () => {},
      unlistable: new Set([BUILT_DOWNLOADS_DIR]),
    },
  ];

  it.each(buildHintCases)(
    "$hint the owner to build when the red is $name",
    ({ hint, break: breakFiles, unlistable }) => {
      const errors: string[] = [];
      const spy = vi
        .spyOn(console, "error")
        .mockImplementation((message: unknown) => {
          errors.push(String(message));
        });

      try {
        const files = createValidFiles();
        breakFiles(files);

        expect(
          runCloudflareStaticAssetHeaderCli(
            createVirtualRepo(
              files,
              unlistable === undefined ? {} : { unlistable },
            ),
          ),
        ).toBe(false);
        if (hint === "tells") {
          expect(errors.join("\n")).toContain("pnpm website:build:cf");
        } else {
          expect(errors.join("\n")).not.toContain("pnpm website:build:cf");
        }
      } finally {
        spy.mockRestore();
      }
    },
  );
});
