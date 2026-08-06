import { describe, expect, it } from "vitest";
import {
  collectCloudflareStaticAssetHeaderFailures,
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

import {
  ASSETS_DIR,
  BUILT_DOWNLOADS_DIR,
  BUNDLE_PATH,
  CATALOG_PATH,
  createValidFiles,
  createVirtualRepo,
  EXPECTED_DOWNLOADS_HEADER_ROUTE,
  EXPECTED_STATIC_ASSET_HEADER_ROUTE,
} from "./cloudflare-headers-fixtures";

// 这份守的是「wrangler 会把哪些规则整条丢掉」：非法路由行、超限、无效占位符、
// 空块、空值。丢掉的规则线上一条头都不设，门禁若认它就是假绿；反过来，把正当规则
// 当成非法丢掉，就是拦住一次完全正当的发布。
// 留下来的规则怎么编译、怎么命中由 cloudflare-headers-wrangler-semantics 守。
describe("Cloudflare header rules wrangler throws away", () => {
  it("ignores a rule whose duplicate placeholder names cannot compile", () => {
    // wrangler 把占位符编译成命名捕获组，`/:x/:x` 会生成两个同名分组，`RegExp`
    // 直接抛异常，`generateRulesMatcher` catch 之后把这条规则整个丢掉。换成匿名
    // 分组它就成了一条正常规则，底下的 noindex 被算作生效，而线上根本没有。
    const duplicateNames = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/:x/:x",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": duplicateNames,
        ".open-next/assets/_headers": duplicateNames,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("ignores rules wrangler itself throws away", () => {
    // wrangler 一条规则最多一个 `*`，也不许 `*` 和 `:splat` 混用，非法的整条跳过。
    // 门禁把这类规则算作生效，就是假绿：线上那个 noindex 根本没被采纳。
    const invalid = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/download*/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/:splat*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": invalid,
        ".open-next/assets/_headers": invalid,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("drops the header lines under a route line wrangler rejects", () => {
    // 被丢弃的路由行会把它底下的响应头一起吃掉，而不是让那些头挂到上一个块名下。
    // 把这两行并进 downloads 块，门禁就会说 PDF 有 noindex，而线上 downloads 块
    // 一条头都没有。
    const swallowed = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "ftp://bad.example/downloads/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": swallowed,
        ".open-next/assets/_headers": swallowed,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("ignores a route line longer than wrangler's limit", () => {
    // wrangler 整行忽略超过 2000 字符的行。一条归一化后是 `/downloads/*`、但靠
    // `/./` 填到 2000 以上的规则，线上根本不生效，门禁若认它就是假绿。
    const padding = "/.".repeat(1010);
    const overlong = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      `/downloads${padding}/*`,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    expect(`/downloads${padding}/*`.length).toBeGreaterThan(2000);

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": overlong,
        ".open-next/assets/_headers": overlong,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("puts wrangler's line limit at exactly two thousand characters", () => {
    // 边界钉在两侧：2000 字符照收，2001 字符整行丢掉。只测「远超」的话，把判据写成
    // `> 2000 + 1` 也全绿，而恰好 2001 字符的规则 wrangler 丢、门禁认，就是假绿。
    const noindexAt = (route: string) =>
      [
        EXPECTED_STATIC_ASSET_HEADER_ROUTE,
        `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
        "",
        route,
        `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
        "",
      ].join("\n");
    const runWith = (route: string) => {
      const headers = noindexAt(route);
      return collectCloudflareStaticAssetHeaderFailures(
        createVirtualRepo({
          ...createValidFiles(),
          "public/_headers": headers,
          ".open-next/assets/_headers": headers,
        }),
      );
    };

    // 两条都靠 `/.` 和 `/a/..` 填长度，归一化后都是 `/downloads/*`。
    const atLimit = `/downloads${"/.".repeat(994)}/*`;
    const pastLimit = `/downloads${"/.".repeat(992)}/a/../*`;
    expect(atLimit).toHaveLength(2000);
    expect(pastLimit).toHaveLength(2001);

    expect(runWith(atLimit)).toEqual([]);
    expect(runWith(pastLimit)).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("ignores rules past wrangler's hundred-rule limit", () => {
    // 第 101 条规则以及之后的整段文件都不生效。把 noindex 写在那之后，线上没有，
    // 门禁若认它就是假绿。
    const filler = Array.from({ length: 100 }, (_, index) =>
      [`/filler-${index}/*`, "  X-Filler: 1", ""].join("\n"),
    ).join("\n");
    const overflowing = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      filler,
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": overflowing,
        ".open-next/assets/_headers": overflowing,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${CATALOG_PATH} in public/_headers is served without`,
      ),
    );
  });

  it("stops reading the file at the limit instead of skipping one line", () => {
    // wrangler 在超限那一行 `break`：整段文件后面全不看。写成 `continue` 只是
    // 「跳过这一条路由行」，它底下那些响应头会挂到**上一个**块名下——超限之后的一行
    // `! X-Robots-Tag` 就会把第 100 条规则给的 noindex 撤掉，而线上它压根不生效。
    // 只测「超限之后的 noindex 不算数」两种写法都过，这一条才分得开。
    // 超限那一行底下写的必须是**同块内自己抵消不掉**的东西。写 `! X-Robots-Tag`
    // 两种实现都绿：它落回 downloads 块时，那个块自己又设了 noindex，而每条规则
    // 都是先撤销后设置，撤了又设回来，等于没发生。改成追加一条 no-store 就不同了，
    // 同名头是拼接的，一年缓存当场作废。
    const filler = Array.from({ length: 99 }, (_, index) =>
      [`/filler-${index}/*`, "  X-Filler: 1", ""].join("\n"),
    ).join("\n");
    const overflowing = [
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      filler,
      // 第 100 条：给 bundle 一年不可变缓存的那一条，也是超限时还挂着的那一条。
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      // 第 101 条：wrangler 从这里起整段不看。
      "/overflow/*",
      "  Cache-Control: no-store",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": overflowing,
        ".open-next/assets/_headers": overflowing,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("throws away a route line that is neither https nor a path", () => {
    // `LINE_IS_PROBABLY_A_PATH` 认 `xxx://` 开头的任何一行，而绝对 URL 只认 https。
    // `ftp://` 那条既不是合法绝对 URL、也不以 `/` 开头，wrangler 整条丢掉。
    //
    // 和端口那条一样，写一条证明不了「被丢掉」：它拼出来的路径怎么样都匹配不上真实
    // 文件，认不认都是绿。写两条一模一样的才看得见——丢掉就什么都不剩，认下来就是
    // 同一个键写了两次。
    const twiceRejected = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "ftp://bad.example/downloads/*",
      "  ! X-Robots-Tag",
      "",
      "ftp://bad.example/downloads/*",
      "  X-Filler: 1",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": twiceRejected,
        ".open-next/assets/_headers": twiceRejected,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("keeps a rule whose placeholder merely starts with splat", () => {
    // wrangler 拦的是**恰好**叫 `:splat` 的占位符（`/:splat(?!\w)/`），不是任何以
    // splat 开头的名字。用 `includes(":splat")` 会把 `:splatting` 这种正当占位符
    // 连同整条规则丢掉——丢的是本该生效的规则，门禁于是少证明一批文件却不吭声。
    const placeholderDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/:splatting/*",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");
    const files = createValidFiles();
    files[`${BUILT_DOWNLOADS_DIR}/eu/regional.pdf`] = "%PDF-1.7";
    files["public/_headers"] = placeholderDetach;
    files[`${ASSETS_DIR}/_headers`] = placeholderDetach;

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        '/downloads/eu/regional.pdf in public/_headers is served without "x-robots-tag"',
      ),
    );
  });

  it("throws away a block that never sets or unsets anything", () => {
    // 一条头都没有的块 wrangler 根本不存。存下来的话，同一条路由写两次就成了
    // 「声明两次」——门禁会拦住一次完全正当的发布，而线上什么问题都没有。
    const emptyBlock = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": emptyBlock,
        ".open-next/assets/_headers": emptyBlock,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("drops a header line whose value is empty", () => {
    // `X-Robots-Tag:` 后面什么都没有，wrangler 整行不要，那个块于是一条头都没有、
    // 整条也不存。认下这一行的话门禁会以为 PDF 带着一个空的 noindex——报出来的话
    // 也是另一句（「带了但不对」而不是「根本没带」），业主会去改一个不存在的值。
    const emptyValue = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      "  X-Robots-Tag:",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": emptyValue,
        [`${ASSETS_DIR}/_headers`]: emptyValue,
      }),
    );

    expect(failures).toContainEqual(
      `${CATALOG_PATH} in public/_headers is served without "x-robots-tag"`,
    );
  });

  it("ignores a detach written on a non-https absolute URL", () => {
    // wrangler 的绝对 URL 只认 https，`http://` 那条整块跳过。算它撤掉了头
    // 就是误红，会拦住一次完全正当的发布。
    const httpDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "http://tucsenberg.com/downloads/*",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": httpDetach,
        ".open-next/assets/_headers": httpDetach,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("throws away a route whose host carries a port", () => {
    // wrangler 明确拒绝带端口的绝对 URL（`validateUrl` 的 disallowPorts）。
    //
    // 光写一条带端口的撤销证明不了这件事：那条规则的模式里带着 `:8080`，而请求的
    // 目标串永远不带端口，认不认它都匹配不上，两种实现输出一模一样。要让「被丢掉」
    // 这件事本身能被看见，就写**两条一模一样的**——丢掉了就什么都不剩，认下来就是
    // 同一个键写了两次，后一条整块盖掉前一条，门禁必须判红。
    const portDetach = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "https://tucsenberg.com:8080/downloads/*",
      "  ! X-Robots-Tag",
      "",
      "https://tucsenberg.com:8080/downloads/*",
      "  X-Filler: 1",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": portDetach,
        ".open-next/assets/_headers": portDetach,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("ignores the header lines under a route line with two wildcards", () => {
    // 两个通配符的规则 wrangler 在解析阶段就丢了，底下那些头跟着一起没了——它不会
    // 进规则表，所以写两遍也不算重复路由。认下它就等于凭空多出一条线上没有的规则。
    const twoWildcards = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/*/*",
      "  X-Custom: a",
      "",
      "/downloads/*/*",
      "  X-Custom: b",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": twoWildcards,
        ".open-next/assets/_headers": twoWildcards,
      }),
    );

    expect(failures).toEqual([]);
  });

  it("drops a rule whose placeholder names collide by prefix", () => {
    // wrangler 逐个占位符做 split/join，而匹配列表是替换开始前算好的。处理 `:x`
    // 时会把 `:xfoo` 的前缀一起换掉，生成两个同名捕获组，整条规则被丢掉。
    // 各换各的就能编译成功，于是一条线上根本不存在的规则被当成「把缓存补回来了」。
    const collided = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/_next/static/:dir/*",
      "  Cache-Control: no-store",
      "",
      "/_next/static/:x/:xfoo",
      "  ! Cache-Control",
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": collided,
        ".open-next/assets/_headers": collided,
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `${BUNDLE_PATH} in public/_headers carries "Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}" but no-store overrides it`,
      ),
    );
  });

  it("drops a header line that has no name before the colon", () => {
    // 冒号前面什么都没有的行，wrangler 单独有一支把它丢掉（cli.js:129151，和「空值」
    // 那一支是两个独立的 if）。收下它的话，门禁会拿一个空字符串去问运行时接不接受，
    // 然后判红说「"" 不是运行时接受的头名，每个命中的资源都返回 500」。
    // 实测：真服务上那份 PDF 返回 200 并带着 noindex，这句话两个方向都不成立。
    const orphanValue = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "  : orphan-value",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo({
        ...createValidFiles(),
        "public/_headers": orphanValue,
        [`${ASSETS_DIR}/_headers`]: orphanValue,
      }),
    );

    expect(failures).toEqual([]);
  });
});
