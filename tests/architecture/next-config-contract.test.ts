/**
 * `next.config.ts` 的行为契约。
 *
 * 跟 `tucsenberg-site-contract.test.ts` 分开放，是因为这里的做法不一样：那个文件
 * 读仓库里的文本，这个文件 import 并执行配置本身。原来这两条挂在那边，靠在
 * next.config.ts 的源码里找字符串来判断。找到字符串不等于配置生效，两条都因此
 * 长期失灵，详见各自的注释。
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const { toDirectiveSet } = createRequire(import.meta.url)(
  "../../scripts/quality/checks/wrangler-headers-semantics.js",
) as { toDirectiveSet: (name: string, value: string) => Set<string> };

describe("next.config contract", () => {
  it("uses the native Rust React Compiler for Turbopack builds", async () => {
    const nextConfigModule = await import("../../next.config");

    expect(nextConfigModule.default.reactCompiler).toBe(true);
    expect(
      nextConfigModule.default.experimental?.turbopackRustReactCompiler,
    ).toBe(true);
  });

  it("keeps the request-quote route out of Instant Navigations", async () => {
    const requestQuotePage =
      await import("../../src/app/[locale]/request-quote/page");

    expect(requestQuotePage.instant).toBe(false);
  });

  it("keeps the TS7 project CLI isolated from Next's TS6 dependency", async () => {
    const nextConfigModule = await import("../../next.config");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(nextConfigModule.default.experimental?.useTypeScriptCli).toBe(false);
    expect(packageJson.devDependencies?.["@typescript/native"]).toBe(
      "npm:typescript@7.0.2",
    );
    expect(packageJson.devDependencies?.typescript).toBe(
      "npm:@typescript/typescript6@6.0.2",
    );
    expect(packageJson.scripts?.["type-check"]).toBe(
      "next typegen && tsc --noEmit",
    );
    expect(
      execSync("pnpm exec tsc --version", { encoding: "utf8" }).trim(),
    ).toBe("Version 7.0.2");
  });

  // 原来是在源码里找三个字符串：APP_ENV 判断、source: "/:path*"、
  // value: "noindex, nofollow"。三个字符串各自存在，不等于它们拼成了一条规则，
  // 分处三个不相干的对象、甚至躺在注释里，照样全部找得到。这里真的调一次
  // `headers()`，按环境看它到底吐出什么。
  it("sets ordinary non-production pages to noindex at the response-header layer", async () => {
    const nextConfigModule = await import("../../next.config");

    const readNoindexRules = async (appEnv: string) => {
      const previous = process.env["APP_ENV"];
      process.env["APP_ENV"] = appEnv;
      try {
        const all = (await nextConfigModule.default.headers?.()) ?? [];

        // 不按 `value === "noindex, nofollow"` 精确比。写成 "noindex"、
        // "noindex, follow"、"NOINDEX"，或者换一种 source 写法照样能把整站从
        // 搜索里拿掉，精确比对全都放行。
        //
        // 也不自己写正则。`X-Robots-Tag: none` 在 Google 的定义里就等于
        // noindex + nofollow，`/noindex/` 看不见它；按爬虫下指令的写法
        // （`bingbot: noindex`）又只对那一个爬虫生效，不该算全站。这两条语义
        // 仓库里已经有一份，Cloudflare 静态资源头那个门禁在用，直接复用它，
        // 别让同一件事在两个地方各判各的。
        const noindex = all.flatMap((rule) =>
          rule.headers
            .filter((header) =>
              toDirectiveSet(header.key.toLowerCase(), header.value).has(
                "noindex",
              ),
            )
            .map((header) => `${rule.source} => ${header.value}`),
        );
        return { all, noindex };
      } finally {
        if (previous === undefined) {
          delete process.env["APP_ENV"];
        } else {
          process.env["APP_ENV"] = previous;
        }
      }
    };

    const staging = await readNoindexRules("staging");
    const production = await readNoindexRules("production");

    // 先证明 `headers()` 真的吐了东西出来。少了这一步，`headers()` 哪天返回空数组
    // 或者干脆没定义，下面的清单比对就会一路绿到底。
    expect(staging.all.length).toBeGreaterThan(0);
    expect(production.all.length).toBeGreaterThan(0);

    // 钉死完整清单，不是「除了 PDF 那条以外没有别的」。用规则形状去猜哪条是 PDF
    // 那条，改写 PDF 的 source 就会被误判成盖住普通页面。清单比对没有这个猜测：
    // 多一条、少一条、换个值、换个 source，都会红，改的人顺手把这里改对就行。
    // PDF 是买家资料不是落地页，它那条 noindex 两个环境都在，是有意的。
    const pdfRule = "/downloads/:path*.pdf => noindex";
    expect(production.noindex).toEqual([pdfRule]);
    expect(staging.noindex).toEqual(["/:path* => noindex, nofollow", pdfRule]);
  });

  // 原来断的是「unsplash 和 placeholder 这两个名字不在配置里」。那只挡得住这两个
  // 名字，换一个远程主机照样绿。要守的是：配置层不许开远程图片主机或自定义
  // 加载器，开了就意味着 Cloudflare 要另做一轮部署证明（见 next.config.ts 里
  // 那段注释）。
  //
  // 名字里写的是「配置层」，不是「整站没有远程图片」，因为这条证不到后者：
  // Cloudflare 分支下 `unoptimized: true`，Next 直接把组件给的 src 原样输出，
  // 配置里的 loader 和 path 根本不参与；组件自己传 `loader` 或 `overrideSrc`
  // 也能绕过配置。那是组件使用面的事，得另有测试去守，不能靠这条冒充。
  //
  // 断言的是 import 回来的成品配置，不是源码文本。扫源码挡不住把配置写进变量、
  // spread 进来、拆到别的文件、或者用计算属性名，那四种写法都能装出一个绿灯。
  // 成品对象没有这些花样可玩。
  //
  // 两个部署目标都要看：`images` 块里有一段是 `isCloudflare` 才生效的，而
  // `isCloudflare` 在模块加载时就定下来了。只跑默认那次，远程主机藏进 Cloudflare
  // 分支就永远看不到。
  it.each([
    ["local build", undefined],
    ["cloudflare build", "cloudflare"],
  ])(
    "configures no remote image optimizer host or custom loader (%s)",
    async (_label, platform) => {
      const previous = process.env["DEPLOYMENT_PLATFORM"];
      if (platform === undefined) {
        delete process.env["DEPLOYMENT_PLATFORM"];
      } else {
        process.env["DEPLOYMENT_PLATFORM"] = platform;
      }

      try {
        vi.resetModules();
        const nextConfigModule = await import("../../next.config");
        const images = (nextConfigModule.default.images ?? {}) as Record<
          string,
          unknown
        >;

        // 这五个键是 Next 16 里能把图片请求送到远程主机的全部入口，对照
        // node_modules/next/dist/shared/lib/image-config.d.ts 核过。`path` 容易漏：
        // 默认 loader 把它当端点前缀直接拼进请求（image-loader.js 里那行
        // `${config.path}?url=...`），写成一个 https 地址，每张图都走外站。
        // `localPatterns` 只管本地路径，不在此列。
        //
        // 判的是生效值不是键在不在。`remotePatterns: []` 或 `loader: "default"`
        // 并没有开放任何东西，按键存在去判会把它们误杀成红灯。
        expect(images["remotePatterns"] ?? []).toEqual([]);
        expect(images["domains"] ?? []).toEqual([]);
        expect(images["loader"] ?? "default").toBe("default");
        expect(images["loaderFile"] ?? "").toBe("");

        const imagePath = (images["path"] ?? "/_next/image") as string;
        expect(imagePath.startsWith("/"), imagePath).toBe(true);
      } finally {
        if (previous === undefined) {
          delete process.env["DEPLOYMENT_PLATFORM"];
        } else {
          process.env["DEPLOYMENT_PLATFORM"] = previous;
        }
        vi.resetModules();
      }
    },
  );

  // 上面那条守配置层。这条守使用面：Cloudflare 构建下 `unoptimized: true`，
  // 组件传什么 src 就输出什么，配置拦不住。远程图片在这套部署里不只是慢，
  // 它绕过整条图片管线，业主看到的是产品图在生产环境随机不出来。
  //
  // 认的是「带图片扩展名的远程 URL」，不是 `src=` 这种写法。只盯 `src=` 会漏掉
  // MDX 里的 `![](https://…)`、`srcSet`、CSS 的 background-image、
  // `openGraph.images`，以及先把完整地址存进常量再传下去。反过来，`src=` 会连
  // script 和 iframe 的 src 一起判红，那不是这条该管的事，站里现在那个 GA
  // 脚本标签就是。按扩展名认，上面几种写法一次覆盖，脚本和 iframe 不受影响。
  //
  // 它扫的是源码文本，不是构建产物，所以注释里写一个示例图片地址也会红。名字
  // 里说的是 source，别读成「已验证浏览器最终加载了什么」。
  //
  // 射程之外，出现了得单独裁决，别指望这条拦：不带扩展名的地址（CDN 签名 URL）、
  // 分段拼起来或 `new URL()` 合成的地址、`%2Epng` 这类转义、`?format=png` 这种
  // 把类型放在 query 里的写法，以及 `public/`、`wrangler.jsonc`、`next.config.ts`
  // 这些不在扫描根目录里的地方。这个站的图片全部来自 public/。
  it("keeps remote image urls out of component, content and message source", () => {
    // 结尾不写「可选的 ?query」那一段：它跟前面的 `[^…]*` 能匹配同一批字符，
    // 正则引擎要来回试，eslint 的 detect-unsafe-regex 会直接判红。用 `\b` 收尾
    // 一样能认出 `hero.png?w=200`，而且只有一处重复，不会回溯。
    const REMOTE_IMAGE_URL =
      /https?:\/\/[^\s"'`)<>]*\.(?:png|jpe?g|webp|avif|gif|svg)\b/giu;

    // `messages` 也要扫：买家看到的文案在那儿，一条带图片 URL 的文案跟组件里
    // 写死一个远程图片，效果是一样的。
    const trackedFiles = execSync("git ls-files src content messages", {
      encoding: "utf8",
    })
      .split("\n")
      .filter((filePath) => /\.(?:tsx?|mdx|json|css)$/u.test(filePath))
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test filters git-listed repo files that may be deleted in the current worktree
      .filter((filePath) => existsSync(filePath))
      // 测试夹具里本来就有假的远程图片地址（结构化数据、CSP 上报的样本），
      // 它们不进产物。留下的是会打包进站点的源码，不等于买家最终加载的资源。
      .filter((filePath) => !/(?:^|\/)__tests__\/|\.test\./u.test(filePath));

    // 扫描范围缩水了不会报错，只会少扫，然后一路绿。所以点名三个深层文件，
    // 每个来自一个根目录：清单没递归到底，这里立刻红。光钉一个文件数下限不够，
    // 光 src 顶层就四百多个，缩水了数字照样过线。
    for (const required of [
      "src/components/forms/inquiry-form.tsx",
      "content/pages/en/contact.mdx",
      "messages/profiles/b2b-lead/en/messages.json",
    ]) {
      expect(trackedFiles, required).toContain(required);
    }

    const offenders = trackedFiles.flatMap((filePath) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo files listed by git
      const source = readFileSync(filePath, "utf8");
      return [...source.matchAll(REMOTE_IMAGE_URL)].map(
        (match) => `${filePath} :: ${match[0]}`,
      );
    });

    expect(offenders).toEqual([]);
  });
});
