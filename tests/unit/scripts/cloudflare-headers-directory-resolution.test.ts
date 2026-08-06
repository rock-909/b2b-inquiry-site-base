import { describe, expect, it } from "vitest";
import {
  collectCloudflareStaticAssetHeaderFailures,
  EXPECTED_DOWNLOADS_NOINDEX,
  EXPECTED_STATIC_ASSET_CACHE_CONTROL,
} from "../../../scripts/quality/checks/cloudflare-static-asset-headers.js";

import {
  ASSETS_DIR,
  BUILT_DOWNLOADS_DIR,
  createValidFiles,
  createVirtualRepo,
  DOWNLOADS_DIR,
  ROOT_DIR,
  STATIC_DIR,
  EXPECTED_DOWNLOADS_HEADER_ROUTE,
  EXPECTED_STATIC_ASSET_HEADER_ROUTE,
} from "./cloudflare-headers-fixtures";

// 这份守的是「受保护目录在磁盘上到底叫什么、它底下的东西看不看得了」：名字被文件
// 系统折叠、目录列不出来、条目 stat 不了、目录是空的。答不上来时必须停下判红，
// 不能按写死的前缀接着算——那样每一条结论说的都是一条线上不存在的 URL。
// 哪些文件会被发布出去由 cloudflare-headers-published-surface 守。
describe("Cloudflare protected directory resolution", () => {
  // 三个受保护目录各判各的，两种折叠各测一遍。第二种是关键：`ſ`（U+017F）在 macOS
  // 的 APFS 上等于 `s`，但 `"ſ".toLowerCase()` 还是 `"ſ"`，拿 JS 的大小写规则当判据
  // 的话它原样漏过去。
  const foldedDirs = [
    { real: DOWNLOADS_DIR, onDisk: "public/Downloads" },
    { real: BUILT_DOWNLOADS_DIR, onDisk: `${ASSETS_DIR}/Downloads` },
    { real: STATIC_DIR, onDisk: `${ASSETS_DIR}/_next/Static` },
  ];
  const folds = [
    { name: "case", fold: (value: string) => value.toLowerCase() },
    { name: "long s", fold: (value: string) => value.replace(/ſ/gu, "s") },
  ];

  it.each(
    foldedDirs.flatMap(({ real, onDisk }) =>
      folds.map(({ name, fold }) => ({
        real,
        // 长 s 那一版把折叠后等于 `s` 的那个字母换掉，磁盘真名就带上了 U+017F。
        onDisk: name === "case" ? onDisk : real.replace(/s([^/]*)$/u, "ſ$1"),
        fold,
        name,
      })),
    ),
  )(
    "refuses to guess the url when $real is on disk as $onDisk ($name)",
    ({ real, onDisk, fold }) => {
      // wrangler 建清单拿的是 readdir 给出的真名，线上那条 URL 跟着真名走，
      // `/downloads/*` 那条规则匹配不上（正则不带 `i`），文件全部裸奔，而门禁按
      // 自己编出来的 URL 求头，一片绿。真名猜不出来时不能接着算，只能说算不出来。
      const files = createValidFiles();
      for (const key of Object.keys(files)) {
        if (!key.startsWith(`${real}/`)) continue;
        files[key.replace(real, onDisk)] = files[key] ?? "";
        delete files[key];
      }

      const failures = collectCloudflareStaticAssetHeaderFailures(
        createVirtualRepo(files, { fold: fold }),
      );

      expect(failures).toContainEqual(
        `${real} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
      );
    },
  );

  it("does not claim it cannot work out a url it just worked out", () => {
    // 目录名折叠之后，整棵树的扫描按 readdir 真名照样算得出每一份文档的 URL，而且
    // 会逐条判红。这时候还说「算不出这个目录里文件的 URL」，同一份报告就自己打自己
    // 的脸——业主看到第一句会以为没人查过那几份 PDF，其实下面几行正是查的结果。
    const files = createValidFiles();
    for (const name of ["catalog.pdf", "spec-sheet.pdf"]) {
      files[`public/Downloads/${name}`] =
        files[`${DOWNLOADS_DIR}/${name}`] ?? "";
      delete files[`${DOWNLOADS_DIR}/${name}`];
    }

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, { fold: (value) => value.toLowerCase() }),
    );

    // 整句相等，不是 stringContaining：后半截才是这条要守的东西。它已经在
    // `Downloads/` 里了，再劝他「挪进 downloads/」是假话，而真正的动作下一句已经
    // 说了——把目录名改回小写。
    expect(failures).toContainEqual(
      '/Downloads/catalog.pdf in public/_headers is served without "x-robots-tag"',
    );
    expect(failures).toContainEqual(
      `${DOWNLOADS_DIR} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
    );
  });

  it("says nothing about a url it just said it cannot work out", () => {
    // 目录名算不出来之后还按写死的前缀逐文件证明，出来的每一条结论说的都是一条线上
    // 不存在的 URL：这里 `_headers` 写的是真名 `/Downloads/*`，PDF 线上带着 noindex，
    // 而按 `/downloads/...` 算会说它们全是裸的。同一次运行里前一句说「算不出来」、
    // 后几句拿那条算不出来的 URL 下结论，两个方向都不成立。
    const realName = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      "/Downloads/*",
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
    ].join("\n");
    const files = createValidFiles();
    files["public/_headers"] = realName;
    files[`${ASSETS_DIR}/_headers`] = realName;
    for (const dir of [DOWNLOADS_DIR, BUILT_DOWNLOADS_DIR]) {
      for (const name of ["catalog.pdf", "spec-sheet.pdf"]) {
        files[`${dir.replace(/downloads$/u, "Downloads")}/${name}`] =
          files[`${dir}/${name}`] ?? "";
        delete files[`${dir}/${name}`];
      }
    }

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, { fold: (value) => value.toLowerCase() }),
    );

    expect(failures).toEqual([
      `${DOWNLOADS_DIR} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
      `${BUILT_DOWNLOADS_DIR} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
    ]);
  });

  it("stops instead of guessing when it cannot confirm a directory name", () => {
    // 上层列不出来时，「名字是不是被折叠了」这个问题答不上来。答不上来还照算，就是
    // 拿一条可能不存在的 URL 逐条下结论：这里磁盘真名是 `Downloads`，线上那条 URL
    // 是 `/Downloads/catalog.pdf`，而门禁会按 `/downloads/...` 说它们都带着 noindex。
    // 曾经把 readdir 失败当成「不折叠」，理由是「列不出来的目录名字本身没有可疑之
    // 处」——在不区分大小写的卷上这句是错的：上层列不出来、下层用折叠名照样列得动，
    // 三个环节全都不说话，门禁零条失败，而六份 PDF 线上一条头都没有。
    const detached = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      // 只存在于构建产物里的那份。照算下去它会被判红，而那条 URL 线上不存在。
      "/downloads/generated-only.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");
    const files = createValidFiles();
    files["public/_headers"] = detached;
    files[`${ASSETS_DIR}/_headers`] = detached;
    for (const name of ["catalog.pdf", "spec-sheet.pdf"]) {
      files[`${ASSETS_DIR}/Downloads/${name}`] =
        files[`${BUILT_DOWNLOADS_DIR}/${name}`] ?? "";
      delete files[`${BUILT_DOWNLOADS_DIR}/${name}`];
    }
    files[`${ASSETS_DIR}/Downloads/generated-only.pdf`] = "%PDF-1.7";

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, {
        // 不区分大小写的卷：查 `downloads` 会命中磁盘上的 `Downloads`。
        fold: (value) => value.toLowerCase(),
        // 资产根列不出来，它底下那个折叠名的目录照样列得动。
        unlistable: new Set([ASSETS_DIR]),
      }),
    );

    // 整份清单比对。答不上来时最容易冒出来的假话有三种：说下层列不出来、说下层是
    // 空的、以及按写死前缀照常逐文件下结论。一条都不能有。
    //
    // 第一句是整棵树的扫描说的：资产根都打不开，「它底下没有裸奔的 PDF」这句话就
    // 没有证据。它和后面两句说的是同一个成因，但覆盖的是不同的东西，不能省。
    expect(failures).toEqual([
      `${ASSETS_DIR} could not be listed (EACCES), so nothing under it is proven`,
      `${ASSETS_DIR} could not be listed (EACCES), so this check cannot tell whether ${BUILT_DOWNLOADS_DIR} is spelled the same on disk as in the URL`,
      `${ASSETS_DIR} could not be listed (EACCES), so this check cannot tell whether ${STATIC_DIR} is spelled the same on disk as in the URL`,
    ]);
  });

  it("names the directory it could not list, not the one above it", () => {
    // 列不出来的那一层在中间时，报上层是假的：同一次运行里上层被列了个干净。
    // 只在第一层测过的话，「往下走时把目录名接上去」那一步删掉也照样全绿——那时
    // 上层恰好就是它自己。
    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(createValidFiles(), {
        unlistable: new Set([`${ASSETS_DIR}/_next`]),
      }),
    );

    expect(failures).toEqual([
      `${ASSETS_DIR}/_next could not be listed (EACCES), so nothing under it is proven`,
      `${ASSETS_DIR}/_next could not be listed (EACCES), so this check cannot tell whether ${STATIC_DIR} is spelled the same on disk as in the URL`,
    ]);
  });

  it("names the subtree it could not list instead of calling it empty", () => {
    // 递归到某一层列不出来时返回空数组，等于说「里面没东西」：那一整棵子树的文件
    // 一条都没被证明，而门禁一句话都不说。权限只是成因之一——并发构建把子目录删掉
    // 造成的 ENOENT 走的是同一条路，而这个仓库的构建本来就有三方在并发写产物目录。
    const files = createValidFiles();
    files[`${BUILT_DOWNLOADS_DIR}/nested/leak.pdf`] = "%PDF-1.7";

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, {
        unlistable: new Set([`${BUILT_DOWNLOADS_DIR}/nested`]),
      }),
    );

    expect(failures).toContainEqual(
      `${BUILT_DOWNLOADS_DIR}/nested could not be listed (EACCES), so nothing under it is proven`,
    );
  });

  it("does not call a directory that is simply absent unlistable", () => {
    // 业主没跑构建时撞上的就是这条路径。不存在的东西谈不上「列不出来」，也谈不上
    // 「拼写确认不了」，多说两句看不懂的假话没有意义。
    const files = createValidFiles();
    for (const key of Object.keys(files)) {
      if (key.startsWith(`${ASSETS_DIR}/`)) delete files[key];
    }

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    expect(failures.join("\n")).not.toContain("could not be listed");
    expect(failures).toContainEqual(
      expect.stringContaining(`${BUILT_DOWNLOADS_DIR} holds no built files`),
    );
  });

  it("reports instead of crashing when a protected path is a plain file", () => {
    // `public/downloads` 是个普通文件时 readdir 抛 ENOTDIR。不接住的话门禁变成
    // 崩溃而不是判断，业主看到的是一段堆栈，不是「哪里出了问题」。
    const files = createValidFiles();
    delete files[`${DOWNLOADS_DIR}/catalog.pdf`];
    delete files[`${DOWNLOADS_DIR}/spec-sheet.pdf`];
    files[DOWNLOADS_DIR] = "not a directory";

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files),
    );

    // 整份清单比对。挑一句的话，ENOTDIR 被当成「列不出来」时多冒出来的那句假话
    // 照样溜过去——目录不在和「那根本不是目录」都属于没有可证明的东西。
    expect(failures).toEqual([
      `${DOWNLOADS_DIR} holds no files, so nothing proves "${EXPECTED_DOWNLOADS_NOINDEX}" reaches a real file`,
    ]);
  });

  it("does not call a directory empty when it could not be listed", () => {
    // 一条路径都没列出来，同时又有东西没看成：说它「里面没文件」是假的，它里面很
    // 可能满是没被证明的 PDF。而这句假话还会顺带勾出「先跑构建」那句提示——业主跑
    // 十遍构建也修不好一个权限问题，而真正该看的那行被埋在下面。
    const files = createValidFiles();

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, { unlistable: new Set([BUILT_DOWNLOADS_DIR]) }),
    );

    expect(failures).toEqual([
      `${BUILT_DOWNLOADS_DIR} could not be listed (EACCES), so nothing under it is proven`,
    ]);
  });

  it("names files it could not inspect instead of dropping them", () => {
    // 目录权限 444 时 readdir 列得出名字，对每个孩子 stat 都抛 EACCES。把 stat
    // 失败一律当成「既不是目录也不是文件」丢掉，整棵子树的 PDF 一个都没被证明，
    // 而门禁报零条失败——它看起来在干活，实际上什么都没查。
    // 看不了的那个条目放在第二层，不是第一层。放第一层的话「路径怎么拼」这半边
    // 根本没被测过：那时 relative 是空串，拼上层目录和拼当前目录输出一模一样，
    // 门禁印出一条磁盘上不存在的路径也照样全绿。
    const files = createValidFiles();
    files[`${BUILT_DOWNLOADS_DIR}/regional/eu.pdf`] = "%PDF-1.7";

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, {
        unstattable: new Map([
          [`${BUILT_DOWNLOADS_DIR}/regional/eu.pdf`, "EACCES"],
        ]),
      }),
    );

    expect(failures).toEqual([
      `${BUILT_DOWNLOADS_DIR}/regional/eu.pdf could not be inspected (EACCES), so it is not proven`,
    ]);
  });

  it("proves an entry that is neither a plain file nor a directory", () => {
    // wrangler 建上传清单只排掉目录和符号链接（cli.js:137583），`stat` 跟随之后
    // `isSymbolicLink()` 恒为假，所以实际效果是「不是目录就上传」。门禁这边只认
    // `isFile()` 的话，FIFO、socket、设备节点会被跳过、被 wrangler 传上去，成为
    // 一份没人证明过、可能被搜索引擎抓到的资源。
    const detached = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/pipe.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");
    const files = createValidFiles();
    files[`${BUILT_DOWNLOADS_DIR}/pipe.pdf`] = "";
    files["public/_headers"] = detached;
    files[`${ASSETS_DIR}/_headers`] = detached;

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, {
        irregular: new Set([`${BUILT_DOWNLOADS_DIR}/pipe.pdf`]),
      }),
    );

    expect(failures).toContainEqual(
      expect.stringContaining(
        `/downloads/pipe.pdf in ${ASSETS_DIR}/_headers is served without "x-robots-tag"`,
      ),
    );
  });

  it("stays quiet about an entry whose target is gone", () => {
    // 断链在 readdir 里列得出名字，stat 才发现目标不在了（ENOENT）。跟着它走本来
    // 就走不到任何会被上传的文件，没有可证明的东西。把它和「看不了」混成一句，
    // 每个带断链的仓库都会平白多出一行读不懂的红字。
    const repo = createVirtualRepo(createValidFiles(), {
      // 只在链接表里，不在文件表里：磁盘上列得出这个名字，跟过去什么都没有。
      symlinks: new Set([`${BUILT_DOWNLOADS_DIR}/dangling.pdf`]),
    });

    // 先证明这个场景真的摆出来了。少了这一句，夹具哪天不再列断链，下面那句
    // 「没有失败」照样绿——它变成了在证明一个没发生过的情况。
    expect(
      repo.readdirSync(`${ROOT_DIR}/${BUILT_DOWNLOADS_DIR}`).map((e) => e.name),
    ).toContain("dangling.pdf");
    expect(collectCloudflareStaticAssetHeaderFailures(repo)).toEqual([]);
  });

  it("still names the bare pdf when another directory cannot be resolved", () => {
    // 一个目录算不出来，不能把别的目录的证明一起静音——那份被撤销了 noindex 的 PDF
    // 仍然要被点名。这是这个门禁存在的唯一理由。
    const detached = [
      EXPECTED_STATIC_ASSET_HEADER_ROUTE,
      `  Cache-Control: ${EXPECTED_STATIC_ASSET_CACHE_CONTROL}`,
      "",
      EXPECTED_DOWNLOADS_HEADER_ROUTE,
      `  ${EXPECTED_DOWNLOADS_NOINDEX}`,
      "",
      "/downloads/catalog.pdf",
      "  ! X-Robots-Tag",
      "",
    ].join("\n");
    const files = createValidFiles();
    files["public/_headers"] = detached;
    files[`${ASSETS_DIR}/_headers`] = detached;
    // 源目录折叠成 `Downloads`，构建产物那一份原样留着。
    for (const name of ["catalog.pdf", "spec-sheet.pdf"]) {
      files[`public/Downloads/${name}`] =
        files[`${DOWNLOADS_DIR}/${name}`] ?? "";
      delete files[`${DOWNLOADS_DIR}/${name}`];
    }

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, { fold: (value) => value.toLowerCase() }),
    );

    expect(failures).toContainEqual(
      `${DOWNLOADS_DIR} is not on disk under that exact name, so this check cannot work out which URL its non-document files are served from`,
    );
    expect(failures).toContainEqual(
      expect.stringContaining(
        `/downloads/catalog.pdf in ${ASSETS_DIR}/_headers is served without "x-robots-tag"`,
      ),
    );
  });

  it("does not judge a directory name that never reaches a url", () => {
    // 资产根目录自己的名字被 wrangler 完全剥掉（清单路径是相对它算的），叫什么都
    // 不改变任何一条 URL。拿它判红就是打印一句能当场证伪的话。
    const files = createValidFiles();
    files["wrangler.jsonc"] = [
      "{",
      '  "assets": { "directory": ".open-next/Assets" }',
      "}",
      "",
    ].join("\n");

    const failures = collectCloudflareStaticAssetHeaderFailures(
      createVirtualRepo(files, { fold: (name) => name.toLowerCase() }),
    );

    expect(failures).toEqual([]);
  });
});
