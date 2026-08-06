import { describe, expect, it } from "vitest";
import {
  collectCloudflareStaticAssetHeaderFailures,
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

import {
  CATALOG_PATH,
  createValidFiles,
  createVirtualRepo,
  DOWNLOADS_DIR,
  EXPECTED_DOWNLOADS_HEADER_ROUTE,
  EXPECTED_STATIC_ASSET_HEADER_ROUTE,
} from "./cloudflare-headers-fixtures";

// 这份守的是「留下来的规则怎么编译成正则、怎么命中一个真实文件」：占位符语法、
// 元字符转义、路径百分号编码、域名怎么分场景、重复路由怎么算。每一条都对应一个曾经
// 真实存在的假绿或误红。
// 哪些规则压根活不到这一步由 cloudflare-headers-rule-rejection 守；命中之后算什么值
// 由 cloudflare-headers-effective-value 守。
describe("wrangler _headers semantics the gate ports", () => {
  it("fails when a more specific downloads route detaches the noindex", () => {
    // Cloudflare 允许 `! Header-Name` 把上层规则设的头撤掉。通配块写着 noindex、
    // 更具体的那个 PDF 把它撤掉，被放出去的正是那一个文件，而通配块看起来完全正常。
    const detached = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      CATALOG_PATH,
      "  ! X-Robots-Tag",
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
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("fails when a placeholder route detaches the noindex off a real pdf", () => {
    // 占位符路由不以 /downloads 开头，按前缀找撤销的写法完全看不见它——而
    // `/:section/catalog.pdf` 会命中 `/downloads/catalog.pdf`，那个 PDF 的
    // noindex 就这么没了。命中与否必须走路径匹配，不能靠字符串前缀猜。
    const placeholder = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/:section/catalog.pdf",
      "  ! X-Robots-Tag",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": placeholder,
        ".open-next/assets/_headers": placeholder,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("fails when a numeric placeholder detaches the noindex off a real pdf", () => {
    // wrangler 的占位符是 `:[A-Za-z]\w*`，`\w` 含数字。按感觉写成 `[a-z_]+` 的话
    // `:section2` 只被吃掉 `:section`，剩个字面量 `2`，于是这条撤销规则线上生效、
    // 门禁完全看不见。
    const numbered = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/:section2/catalog.pdf",
      "  ! X-Robots-Tag",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": numbered,
        ".open-next/assets/_headers": numbered,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("stays quiet when a detach targets a route no real download sits under", () => {
    // `/downloads-archive/*` 以 "/downloads" 开头，但它下面一个真实文件都没有。
    // 按字符串前缀找撤销会在这里误红，拦住一次完全正当的发布。
    const archive = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads-archive/*",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": archive,
        ".open-next/assets/_headers": archive,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("still fails when a domain-scoped rule detaches the noindex off a real pdf", () => {
    // 每个域名各算一遍。在 tucsenberg.com 这个场景里这条撤销真的会跑，PDF 就是
    // 裸的——哪怕别的域名上它带着 noindex，也不能放行。
    const domainDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "https://tucsenberg.com/downloads/*",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": domainDetach,
        ".open-next/assets/_headers": domainDetach,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("matches a route with regex characters literally", () => {
    // wrangler 先把路由里的正则元字符转义，再把 `*` 换成捕获组。少了这一步，
    // `/downloads/(catalog).pdf` 里的括号会被当成捕获组，凭空命中磁盘上那份
    // `catalog.pdf`——线上它是裸的，门禁却认为 noindex 已经盖住了。
    const parenthesised = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/downloads/(catalog).pdf",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/(spec-sheet).pdf",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": parenthesised,
        ".open-next/assets/_headers": parenthesised,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("allows the same path under two different https hosts", () => {
    // `https://a.example/x` 和 `https://b.example/x` 在 wrangler 里是两个键，
    // 可以并存。把域名抹掉再比就会把合法配置判成重复，无条件拦住发布。
    const twoHosts = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "https://a.example/downloads/catalog.pdf",
      "  X-Custom: a",
      "",
      "https://b.example/downloads/catalog.pdf",
      "  X-Custom: b",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": twoHosts,
        ".open-next/assets/_headers": twoHosts,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("fails when an encoded-path rule detaches the noindex off a spaced filename", () => {
    // 磁盘上叫 `catalog copy.pdf`，线上被请求的路径是 `/downloads/catalog%20copy.pdf`。
    // 拿带空格的原名去比就什么都匹配不上，这条撤销线上生效而门禁全绿。
    const encodedDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/catalog%20copy.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        [`${DOWNLOADS_DIR}/catalog copy.pdf`]: "%PDF-1.7",
        "public/_headers": encodedDetach,
        ".open-next/assets/_headers": encodedDetach,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        "/downloads/catalog%20copy.pdf in public/_headers is served without",
      ),
    );
  });

  it("fails when an encoded-path rule detaches the noindex off a caret filename", () => {
    // `^` 不在 URL 规范列出的 path percent-encode set 里，`encodeURIComponent`
    // 照样把它转成 `%5E`，asset worker 的 `encodePath` 用的正是它，所以线上那条
    // URL 里也是 `%5E`。手维护一张字符表就会漏掉这种。
    const caretDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/catalog%5Ecopy.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        [`${DOWNLOADS_DIR}/catalog^copy.pdf`]: "%PDF-1.7",
        "public/_headers": caretDetach,
        ".open-next/assets/_headers": caretDetach,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        "/downloads/catalog%5Ecopy.pdf in public/_headers is served without",
      ),
    );
  });

  it("keeps a literal percent in a filename distinct from an encoded space", () => {
    // 磁盘上真名叫 `a%20b.pdf` 的文件，线上被请求的路径是 `/downloads/a%2520b.pdf`。
    // 不先把 `%` 转成 `%25`，它会和 `a b.pdf` 撞成同一条路径，一条撤销顶两个文件用。
    const percentDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/a%2520b.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        [`${DOWNLOADS_DIR}/a%20b.pdf`]: "%PDF-1.7",
        "public/_headers": percentDetach,
        ".open-next/assets/_headers": percentDetach,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        "/downloads/a%2520b.pdf in public/_headers is served without",
      ),
    );
  });

  it("refuses to judge a rule whose host is not one exact name", () => {
    // 场景是按规则里那串域名的字面量分的。域名段带占位符时这个模型就塌了：
    // `https://:h/downloads/*` 编译成 `(?<h>[^/.]+)`，只能匹配不带点的域名，真实
    // 域名全带点，所以它线上永远不生效；而场景串 `":h"` 不含点，被自己的模式一口
    // 吃下，于是它在每个场景里都把 noindex 补了回来——全绿，线上那份 PDF 却是裸的。
    const wildcardHost = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "https://*/downloads/catalog.pdf",
      "  ! X-Robots-Tag",
      "",
      "https://:h/downloads/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": wildcardHost,
        ".open-next/assets/_headers": wildcardHost,
      }),
    );

    expect(failures).toContainEqual(
      '"https://:h/downloads/*" in public/_headers does not name one exact host, so which responses it reaches cannot be proven; write the host out in full',
    );
    expect(failures).toContainEqual(
      '"https://*/downloads/catalog.pdf" in public/_headers does not name one exact host, so which responses it reaches cannot be proven; write the host out in full',
    );
  });

  it("fails when the same route is declared twice through an equivalent path", () => {
    // wrangler 存规则前会用 `new URL()` 规范化，`/downloads/./*` 和 `/downloads/*`
    // 是同一个键，后写的整块盖掉先写的。只比原始字符串的话这条检测一绕就过。
    const equivalent = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/./*",
      "  Cache-Control: public,max-age=86400",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": equivalent,
        ".open-next/assets/_headers": equivalent,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `"${EXPECTED_DOWNLOADS_HEADER_ROUTE}" is declared more than once in public/_headers`,
      ),
    );
  });

  it("fails when the same route is declared more than once", () => {
    // wrangler 4.100.0 用 `rules[rule.path] = configuredRule` 存规则，后一个整块
    // 盖掉前一个。把两块合并是门禁替线上做主：它说缓存一年 immutable 齐了，
    // 实际只剩后半条。
    const duplicated = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      "  Cache-Control: public, max-age=31536000",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      "  Cache-Control: immutable",
      "",
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      "  X-Third: 1",
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": duplicated,
        ".open-next/assets/_headers": duplicated,
      }),
    );

    // 措辞不能写死次数。写三遍时说「declared twice」是假的，而且业主会照着那句话
    // 去找两个块。
    expect(failures).toContainEqual(
      expect.stringContaining(
        `"${EXPECTED_STATIC_ASSET_HEADER_ROUTE}" is declared more than once in public/_headers`,
      ),
    );
  });
});
