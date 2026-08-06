import { describe, expect, it } from "vitest";
import {
  collectCloudflareStaticAssetHeaderFailures,
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

import {
  BUNDLE_PATH,
  createValidFiles,
  createVirtualRepo,
  STATIC_DIR,
  EXPECTED_DOWNLOADS_HEADER_ROUTE,
  EXPECTED_STATIC_ASSET_HEADER_ROUTE,
} from "./cloudflare-headers-fixtures";

// 这份守的是「命中之后，一个文件最终拿到的那个值是什么」：多条规则怎么叠加、撤销
// 和设置的先后、引号里的指令、占位符替换进值里、大小写。
// 规则本身怎么被解析和匹配由 cloudflare-headers-rule-rejection 和
// cloudflare-headers-wrangler-semantics 守；门禁要证明什么由
// cloudflare-static-asset-headers 守。
describe("effective header value semantics", () => {
  it("keeps an unset name exactly as wrangler leaves it", () => {
    // wrangler 只吃掉第一个 `"! "`，多出来的空格留在头名里，运行时
    // `headers.delete(" X-Cache")` 抛异常，整个响应 500。门禁替它 trim 掉就探不出来。
    const paddedUnset = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "  !  X-Cache-Status",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": paddedUnset,
        ".open-next/assets/_headers": paddedUnset,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        '"!  X-Cache-Status" under "/downloads/*" in public/_headers is not a header name the runtime accepts',
      ),
    );
  });

  it("fails when a domain-scoped rule appends a shorter max-age", () => {
    // 域名规则同理。它只在 tucsenberg.com 上生效，但在那个场景里它确实把缓存
    // 打短了，一年缓存那句保证在那里就是假的。
    const domainShortens = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      `https://tucsenberg.com${BUNDLE_PATH}`,
      "  Cache-Control: max-age=0",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": domainShortens,
        ".open-next/assets/_headers": domainShortens,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but max-age=0 sits beside it on https://tucsenberg.com, so which one applies cannot be proven`,
      ),
    );
  });

  it("does not count directives that only appear inside quotes", () => {
    // HTTP 的字段值允许 quoted-string，里面的逗号是内容不是分隔符。直接按逗号拆，
    // 这一条只有一个扩展指令的头会被拆出正好凑齐期望的 token，每个真实 bundle
    // 都假绿，而线上根本没有一年缓存。
    const quoted = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      '  Cache-Control: foo="x,public,max-age=31536000,immutable,y"',
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": quoted,
        ".open-next/assets/_headers": quoted,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers does not carry "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}"`,
      ),
    );
  });

  it("does not count a quoted directive that hides behind an escaped quote", () => {
    // 引号里的反斜杠是转义，`\"` 不结束 quoted-string。不认这条转义的话，后面那些
    // token 会被当成独立指令，而它们全在引号内部，那个文件一条缓存指令都没有。
    const escaped = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      '  Cache-Control: foo="a\\",public,max-age=31536000,immutable,b"',
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": escaped,
        ".open-next/assets/_headers": escaped,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers does not carry "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}"`,
      ),
    );
  });

  it("refuses to judge a header value whose quotes never close", () => {
    // wrangler 用 append 把多条命中规则的同名头拼成一条，客户端只解析一次。前一条
    // 留一个不闭合的引号、后一条把它关掉，拼起来 `no-store` 落在引号外是真指令。
    // 拆不出确定结果就判红，不猜。
    const unbalanced = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/chunks/*",
      '  Cache-Control: foo="x',
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": unbalanced,
        ".open-next/assets/_headers": unbalanced,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers is served "cache-control:`,
      ),
    );
  });

  it("substitutes a captured placeholder into the header value", () => {
    // wrangler 会把捕获到的值替换进响应头的值里。构建产物里只要有一个文件叫
    // `no-store`，这条规则给它发的就是 `Cache-Control: no-store`，一年缓存当场
    // 作废。只看字面量 `:directive` 的话，它不在任何冲突指令名单里，检查全绿。
    const substituted = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/:directive",
      "  Cache-Control: :directive",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        [`${STATIC_DIR}/no-store`]: "console.log(1)",
        "public/_headers": substituted,
        ".open-next/assets/_headers": substituted,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `/_next/static/no-store in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store overrides it`,
      ),
    );
  });

  it("fails when Vary: * makes the one-year cache unreachable", () => {
    // `Cache-Control` 一个字都没被改，可 `Vary: *` 的意思是「这个响应不能被复用」
    // （RFC 9110 §12.5.5）。只盯着同名头比对的话，这里是彻底的假绿：门禁说缓存一年
    // 到位，而每一次请求都会重新下载整个 bundle。
    const varied = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/chunks/*",
      "  Vary: *",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": varied,
        ".open-next/assets/_headers": varied,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but "Vary: *" beside it means no cache may reuse the response`,
      ),
    );
  });

  it("says the cache header is missing before it blames Vary", () => {
    // `Vary: *` 那一支要是排在「头在不在」前面，一个根本没写 `Cache-Control` 的配置
    // 也会被告知「你写的一年缓存被 Vary 废了」。业主删掉 Vary 重跑，才发现缓存头压根
    // 没写——两趟才走完一趟的事，而这道门禁的每一句话都得当场成立。
    const varyOnly = [
      "/_next/static/*",
      "  Vary: *",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": varyOnly,
        ".open-next/assets/_headers": varyOnly,
      }),
    );

    expect(failures).toContainEqual(
      `${BUNDLE_PATH} in public/_headers is served without "cache-control"`,
    );
    expect(failures.join("\n")).not.toContain('"Vary: *" beside it');
  });

  it("does not let Vary: * count against the noindex proof", () => {
    // `Vary: *` 废掉的是缓存复用，和「搜索引擎会不会收录这份 PDF」没有关系。把这
    // 一支扩大到所有期望头，会在一条完全正当的配置上判红。
    const variedDownloads = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "  Vary: *",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": variedDownloads,
        ".open-next/assets/_headers": variedDownloads,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("does not read a wildcard inside a Vary header name as Vary: *", () => {
    // `Vary: X-Probe-*` 里有星号，但它是一个头名的一部分，不是 RFC 说的那个通配。
    // 用 `includes("*")` 判就会把一条完全正当的配置拦下来，而误红会让业主学会绕过
    // 这道门禁。
    const namedVary = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/chunks/*",
      "  Vary: Accept-Encoding, X-Probe-*",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": namedVary,
        ".open-next/assets/_headers": namedVary,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("judges directives written in upper case the same as lower case", () => {
    // HTTP 的 Cache-Control 指令大小写不敏感，`NO-STORE` 和 `no-store` 是同一件事。
    // 归一化里少了 `.toLowerCase()`，这条 bundle 线上一秒都不缓存，门禁却全绿。
    const shouted = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/chunks/*",
      "  Cache-Control: NO-STORE",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": shouted,
        ".open-next/assets/_headers": shouted,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store overrides it`,
      ),
    );
  });

  it("accepts an upper-case noindex on the downloads route", () => {
    // 反方向同样要成立：`NOINDEX` 是合法写法，判红就是假红。
    const shouted = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag: NOINDEX",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": shouted,
        ".open-next/assets/_headers": shouted,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("applies a rule's own unset before its own set", () => {
    // 一个块里先写撤销再写设置时，Workers Assets 是先撤后设，最终这个头是有的。
    // 顺序反过来的话，合法写法会被判成「没有 noindex」——假红。
    //
    // 这条没有可引的源码行号：套响应头的代码在 cli.js 里被 tree-shake 掉了，bundle
    // 里那个叫 `attachHeaders` 的函数属于 Cloudflare Pages，不是这个仓库用的子系统。
    // 依据是 2026-07-28 用 `wrangler dev --local` 实测出来的四条结论，记在
    // `scripts/quality/checks/wrangler-headers-semantics.js` 的 `resolveEffectiveHeaders` 注释里。
    const unsetThenSet = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  ! X-Robots-Tag",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": unsetThenSet,
        ".open-next/assets/_headers": unsetThenSet,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("ignores a host rule whose spelling no request can ever match", () => {
    // wrangler 比对的是 `new URL(request.url).hostname`：一定小写、IDN 已转 punycode。
    // 规则那一侧原样保留，正则又不带 `i`，所以这两条写法线上永远命中不了任何请求，
    // 里面的撤销一次都不会跑。拿字面量当场景的话，门禁会判红并说这份 PDF 是裸的
    // ——而它在每一个真实域名上都带着 noindex，这句话不成立。
    for (const deadHost of ["TUCSENBERG.example", "例え.example"]) {
      const headers = [
        EXPECTED_STATIC_ASSET_HEADER_ROUTE,
        `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
        "",
        EXPECTED_DOWNLOADS_HEADER_ROUTE,
        `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
        "",
        `https://${deadHost}/downloads/*`,
        "  ! X-Robots-Tag",
        "",
      ].join("\n");

      const failures = collectCloudflareStaticAssetHeaderFailures(
        createVirtualRepo({
          ...createValidFiles(),
          "public/_headers": headers,
          ".open-next/assets/_headers": headers,
        }),
      );

      expect(failures, deadHost).toEqual([]);
    }
  });

  it("still catches an unset on the host spelling requests really carry", () => {
    // 归一化不能把真的撤销一起放过：同一条规则写成线上那个小写域名时必须判红。
    const live = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "https://tucsenberg.example/downloads/*",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": live,
        ".open-next/assets/_headers": live,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        'is served without "x-robots-tag" on https://tucsenberg.example',
      ),
    );
  });

  it("does not let one host's unset erase another host's damage", () => {
    // 把所有域名的规则堆在一份状态里算，它们会互相抵消：a.example 加上的
    // `no-store` 被 b.example 的撤销抹掉，再被后面一条通用规则补回期望值，最后
    // 一片干净。但这两个域名的规则永远不会同时跑在一个响应上——a.example 上那份
    // bundle 实际带着 `no-store`，一年缓存那句保证在那里是假的。
    const twoHosts = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "https://a.example/_next/static/chunks/*",
      "  Cache-Control: no-store",
      "",
      "https://b.example/_next/static/chunks/*",
      "  ! Cache-Control",
      "",
      "/_next/static/chunks/*",
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": twoHosts,
        ".open-next/assets/_headers": twoHosts,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store overrides it on https://a.example`,
      ),
    );
  });
});
