import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import {
  getLocaleCurrency,
  getLocaleTimeZone,
  LOCALES_CONFIG,
} from "@/config/paths/locales-config";
import { getCanonicalPath } from "@/config/paths/utils";
import { getPublicContactEmail } from "@/config/public-trust";
import { TUCSENBERG_REGISTERED_ADDRESS } from "@/config/single-site";
import { getAllMarketSlugs } from "@/constants/product-catalog";

const TARGET_STATIC_PATHS = [
  "/",
  "/products",
  "/oem-wholesale",
  "/guides/flood-barrier-materials-guide",
  "/guides/flood-barrier-specifications",
  "/about",
  "/request-quote",
  "/contact",
  "/warranty",
  "/privacy",
  "/terms",
] as const;

const TARGET_PRODUCT_SLUGS = [
  "abs-flood-barriers",
  "aluminum-flood-gates",
  "absorbent-flood-bags",
  "flood-tube-dams",
  "frp-flood-barriers",
] as const;

const TARGET_MDX_PAGES = [
  "content/pages/en/about.mdx",
  "content/pages/en/contact.mdx",
  "content/pages/en/oem-wholesale.mdx",
  "content/pages/en/flood-barrier-materials-guide.mdx",
  "content/pages/en/flood-barrier-specifications.mdx",
  "content/pages/en/warranty.mdx",
  "content/pages/en/privacy.mdx",
  "content/pages/en/terms.mdx",
] as const;

const TARGET_DOWNLOADS = [
  "public/downloads/product-catalog.pdf",
  "public/downloads/supplier-checklist.pdf",
  "public/downloads/spec-sheet-tb-ag.pdf",
  "public/downloads/spec-sheet-tb-bw.pdf",
  "public/downloads/spec-sheet-tb-fb.pdf",
  "public/downloads/spec-sheet-tb-td.pdf",
] as const;

const ACTIVE_HOMEPAGE_MESSAGE_FILES = [
  "messages/profiles/catalog/en/messages.json",
] as const;

const PUBLIC_SOURCE_ROOTS = ["src", "content", "messages"] as const;
const TUCSENBERG_EMAIL_PATTERN = /[\w.+-]+@tucsenberg\.com/gu;
// A distinctive fragment of the registered address: a file containing it is
// stating the company address and must state the configured one in full.
const REGISTERED_ADDRESS_ANCHOR = "Houhe Village";
const REPLY_WINDOW_PATTERN = /repl(?:y|ies)[^.]{0,40}?within (\d+) hours?/giu;
const PLACEHOLDER_COPY_PATTERNS = [
  /\bTODO\b/u,
  /\bTBD\b/u,
  /lorem ipsum/iu,
  /replace with your/iu,
  /demo starter/iu,
  /\byour-\w+@/iu,
] as const;
// 加 `.css` 的理由：`globals.css` 的注释里挂过启动器的名字，撑了整轮退役没被
// 任何门禁看见——公开文案的扫描只读上面这五种扩展名，`.css` 在射程外。样式表
// 不写买家文案，但它写注释，而"这个站不叫这个名字"是对整棵源码树成立的，不是
// 只对能渲染出文字的文件成立。
const PUBLIC_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".mdx",
  ".css",
]);
const EXCLUDED_PATH_SEGMENTS = new Set(["__tests__", "tests", "test"]);
// 都是「这个站不能这样说」的现行内容政策，不是启动器残留的字符串。前六条是没有
// 的资质和不该沾的话题，第七条是消费者口吻，第八条是本站不提供的支持/合作服务。
//
// 最后那条原来只扫一个首页消息文件，现在跟其他条一起扫 src / content / messages：
// 报价一律走询盘，公开文案里冒出价格在哪个文件都是同一件事，没有理由只在首页
// 那一个文件里管。
//
// 价格拦两种写法。符号式（`$199`）原来就有；文字式（`USD 199`、`199 dollars`、
// `199 元`）是后补的，因为绕开符号规则只要不打符号就行，而买家看到的是同一件事。
//
// 刻意不收 `pounds`：它同时是重量单位。这个站现在通篇用 kg，但真要写 "50 pounds"
// 是一句正当的产品参数，规则不该逼人改写真话。英镑价格由 `£` 和 `GBP` 两条接住。
//
// 这三条也不是「价格」的完整定义。已知抓不到的：全角数字（`１９９ 元`）、拼写出
// 来的金额（`one ninety-nine`）、`199/unit` 这种没有货币词的、以及 `dollars` 前面
// 挂了别的限定词（`199 Canadian dollars`；`US dollars` 已经收了）。别把这几条读成
// 价格全覆盖——真要全覆盖得改成审查人工判断，不是再叠正则。
//
// 启动器身份串（最后四条）本来只有 `content-readiness.js` 的 `starter-identity`
// 规则在管，那条默认 warning，只有 `--strict-client-launch` 才升 error，而那个
// 开关只在生产部署 workflow 里出现。也就是说：这些字符串留在源码里不会让任何
// 一个 pull request 变红，一路撑到上线前才有人拦。搬到这里以后每个 PR 都硬失败。
const FORBIDDEN_PUBLIC_PATTERNS = [
  /\bWestern\b/iu,
  /\btariff\b/iu,
  /customs data/iu,
  /BS\s*851188/iu,
  /FM\s*2510/iu,
  /\bFEMA\b/iu,
  /keeps your house dry/iu,
  /support, or partnership opportunities/iu,
  /[$€£¥￥＄]\s*\d/u,
  /\b(?:USD|EUR|GBP|RMB|CNY)\s*\d/iu,
  /\d\s*dollars?\b/iu,
  // 拆成独立一条、而且用 `\s+` 不用 `\s*`：写成
  // `\d\s*(?:US\s*)?dollars?` 会被 eslint 的 security/detect-unsafe-regex
  // 判成有回溯风险，而 `US` 只在中间出现，上一条的 `\d\s*dollars` 抓不到
  // `199 US dollars`。
  /\d\s+US\s+dollars?\b/iu,
  /\d\s*(?:euros?|yuan|USD|EUR|GBP|RMB|CNY)\b/iu,
  /\d\s*元/u,
  // 分隔符收 `[\s_-]{0,3}`（有界，不会被判回溯风险）：`Showcase-Website-Starter`
  // 和 `Showcase _ Website _ Starter` 跟带空格的是同一个名字，拦一种放一种没有
  // 意义。抓不到的是拆成两个字符串拼接、或者塞 HTML 实体的写法——那已经不是
  // 「没注意留下了」，是有人在绕，文本扫描解决不了，交给审查。
  /showcase[\s_-]{0,3}website[\s_-]{0,3}starter/iu,
  /showcase[\s_-]{0,3}starter/iu,
  /example[\s_-]{0,3}showcase[\s_-]{0,3}company/iu,
  /public[\s_-]{0,3}demo[\s_-]{0,3}starter/iu,
];
const REQUEST_INTENT_PHRASES = [
  /request\s+a\s+quotes?/giu,
  /quote\s+requests?/giu,
  /quotation\s+requests?/giu,
] as const;
const FORBIDDEN_INQUIRY_RESPONSE_EXTRA_PATTERNS = [
  /get exact pricing in 12 hours/iu,
  /12-hour response on standard/iu,
] as const;
const TIMING_12 = /\b(?:12\s*-?\s*hours?|12-hour)\b/iu;
const TIMING_48 = /\b(?:48\s*-?\s*hours?|48-hour)\b/iu;
const QUOTE_TERMS = /\b(?:quotes?|quoted|quotations?)\b/iu;
const EXACT_ACCURATE_PRICING = /\b(?:accurate|exact) pricing\b/iu;
const LOGISTICS_SEMANTICS =
  /\b(?:shipping|delivery|dispatch|ship|deliver(?:y|ed|ies|ing)?)\b/iu;
const LOGISTICS_TIMING_FORBIDDEN =
  /\b(?:accurate|exact) pricing\b|\b(?:quotes?|quoted|quotations?)\b|\b(?:reply|replies|respond|response|answer|answers|answered|receive|get|provide|turnaround)\b/iu;

const FORBIDDEN_QUOTE_TIME_FIXTURES = [
  {
    label: "quote before 12 hours",
    text: "Send details for a quote within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "quoted before within 12 hours",
    text: "Standard items are quoted within 12 hours.",
    repoPath: "content/pages/en/oem-wholesale.mdx",
  },
  {
    label: "12-hour before quote",
    text: 'export const copy = "Standard 12-hour quote turnaround for catalog lines.";',
    repoPath: "src/lib/contact/getContactCopy.ts",
  },
  {
    label: "custom quote before 48 hours",
    text: "Custom quote requests are answered within 48 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
  {
    label: "48-hour before custom quote",
    text: 'export const copy = "48-hour custom quote review for non-standard openings.";',
    repoPath: "src/app/[locale]/request-quote/page.tsx",
  },
  {
    label: "48-hour custom quotation",
    text: "Within 48 hours, custom projects receive a quotation.",
    repoPath: "messages/profiles/catalog/en/messages.json",
  },
  {
    label: "exact pricing em dash reply within 12 hours (mdx)",
    text: "Request a quote for exact pricing using the Request a Quote button on this page — we reply within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "accurate pricing em dash reply within 12 hours (ts)",
    text: 'export const description = "Request a quote for accurate pricing — we reply within 12 hours.";',
    repoPath: "src/lib/contact/getContactCopy.ts",
  },
  {
    label: "exact pricing em dash reply within 12 hours (json)",
    text: "Request a quote for exact pricing — we reply within 12 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
  {
    label: "exact pricing em dash multiline template (tsx)",
    text: "const copy = `Request a quote for exact pricing —\nwe reply within 12 hours.`;",
    repoPath: "src/app/[locale]/request-quote/page.tsx",
  },
  {
    label: "exact pricing within 12 hours (mdx)",
    text: "Exact pricing within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "accurate pricing available within 12 hours (json)",
    text: "Accurate pricing available within 12 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
  {
    label: "accurate pricing available within 12 hours (ts)",
    text: 'export const description = "Accurate pricing available within 12 hours.";',
    repoPath: "src/lib/contact/getContactCopy.ts",
  },
  {
    label: "exact pricing em dash shipping then reply within 12 hours (mdx)",
    text: "Exact pricing — shipping within 12 hours — we reply within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "exact pricing em dash reply then shipping within 12 hours (json)",
    text: "Exact pricing — we reply within 12 hours — shipping within 12 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
] as const;

const ALLOWED_QUOTE_TIME_FIXTURES = [
  {
    label: "delivery within 48 hours",
    text: "In-stock cartons ship with delivery within 48 hours.",
    repoPath: "content/pages/en/warranty.mdx",
  },
  {
    label: "shipping within 48 hours",
    text: 'export const copy = "Express shipping within 48 hours is available on request.";',
    repoPath: "src/app/[locale]/products/page.tsx",
  },
  {
    label: "approved conditional reply copy",
    text: "We reply within 12 hours. If the details are sufficient, the reply includes a quote. Otherwise, we ask only for the missing essentials.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "custom quotes separate from shipping timing (semicolon)",
    text: "Custom quotes exclude freight; shipping within 48 hours.",
    repoPath: "messages/profiles/catalog/en/messages.json",
  },
  {
    label: "custom quotes separate from shipping timing (em dash)",
    text: "Custom quotes exclude freight — shipping within 48 hours.",
    repoPath: "content/pages/en/oem-wholesale.mdx",
  },
  {
    label: "exact pricing and shipping timing in separate clauses (mdx)",
    text: "Learn exact pricing. Shipping within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "exact pricing and shipping timing in separate clauses (json)",
    text: "Learn exact pricing. Shipping within 12 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
  {
    label: "accurate pricing em dash delivery within 12 hours (mdx)",
    text: "The written quote contains accurate pricing — delivery is available within 12 hours.",
    repoPath: "content/pages/en/contact.mdx",
  },
  {
    label: "exact pricing em dash shipping within 12 hours (json)",
    text: "The written quote contains exact pricing — shipping within 12 hours.",
    repoPath: "messages/profiles/b2b-lead/en/messages.json",
  },
] as const;

function hasPlaceholderCopy(text: string): boolean {
  return PLACEHOLDER_COPY_PATTERNS.some((pattern) => pattern.test(text));
}

function stripRequestIntent(clause: string): string {
  return REQUEST_INTENT_PHRASES.reduce(
    (text, pattern) => text.replace(pattern, " "),
    clause,
  );
}

function normalizeQuoteTimingClause(clause: string): string {
  const withoutLinks = clause.replace(
    /\[([^\]]*)\]\([^)]*\)/gu,
    (_match, linkText: string) => linkText,
  );

  return stripRequestIntent(withoutLinks).replace(/\/?request-quote\b/giu, " ");
}

function splitCopyClauses(text: string): string[] {
  return text
    .split(/[;\n\r]+|(?<=[.!?])\s+|\s—\s/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

function isForbiddenQuoteTimeClause(clause: string): boolean {
  const text = normalizeQuoteTimingClause(clause);

  if (TIMING_12.test(text) && QUOTE_TERMS.test(text)) {
    return true;
  }

  return (
    TIMING_48.test(text) &&
    (QUOTE_TERMS.test(text) || /\bcustom\b/iu.test(text))
  );
}

function hasSeparateLogisticsTimingSegment(text: string): boolean {
  const segments = text.split(/\s—\s/u).map(normalizeQuoteTimingClause);
  if (segments.length < 2) {
    return false;
  }

  const timedSegments = segments.filter((segment) => TIMING_12.test(segment));
  const hasSeparatePricingSegment = segments.some(
    (segment) =>
      EXACT_ACCURATE_PRICING.test(segment) && !TIMING_12.test(segment),
  );
  const allTimingIsLogisticsOnly =
    timedSegments.length > 0 &&
    timedSegments.every(
      (segment) =>
        LOGISTICS_SEMANTICS.test(segment) &&
        !LOGISTICS_TIMING_FORBIDDEN.test(segment),
    );

  return hasSeparatePricingSegment && allTimingIsLogisticsOnly;
}

function hasForbiddenExactAccuratePricing12HourPromise(text: string): boolean {
  const normalizedFullText = normalizeQuoteTimingClause(text);
  if (
    !TIMING_12.test(normalizedFullText) ||
    !EXACT_ACCURATE_PRICING.test(normalizedFullText)
  ) {
    return false;
  }

  if (hasSeparateLogisticsTimingSegment(text)) {
    return false;
  }

  const clauses = splitCopyClauses(text);
  const hasSameClauseMatch = clauses.some((clause) => {
    const normalizedClause = normalizeQuoteTimingClause(clause);
    return (
      TIMING_12.test(normalizedClause) &&
      EXACT_ACCURATE_PRICING.test(normalizedClause)
    );
  });

  if (hasSameClauseMatch) {
    return true;
  }

  return /\s—\s/u.test(text);
}

function collectJsonStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectJsonStringValues);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectJsonStringValues);
  }

  return [];
}

function deriveCopyClauses(text: string): string[] {
  return text
    .split(/[;]+|(?<=[.!?])\s+/u)
    .map((clause) => clause.replace(/\s*\n\s*/gu, " ").trim())
    .filter((clause) => clause.length > 0);
}

function collectMdxClauses(source: string): string[] {
  return source
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/gu, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap(deriveCopyClauses);
}

function collectJsonClauses(source: string): string[] {
  return collectJsonStringValues(JSON.parse(source) as unknown).flatMap(
    deriveCopyClauses,
  );
}

function collectTsStaticStrings(source: string, repoPath: string): string[] {
  const scriptKind = repoPath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    repoPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const strings: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      strings.push(node.text);
      return;
    }

    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text.length > 0) {
        strings.push(text);
      }
      return;
    }

    if (ts.isTemplateExpression(node)) {
      strings.push(node.head.text);
      for (const span of node.templateSpans) {
        strings.push(span.literal.text);
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return strings;
}

function collectTsClauses(source: string, repoPath: string): string[] {
  return collectTsStaticStrings(source, repoPath).flatMap(deriveCopyClauses);
}

function quoteTimeFixtureSource(text: string, repoPath: string): string {
  if (repoPath.endsWith(".json")) {
    return JSON.stringify({ copy: text });
  }

  return text;
}

function collectOwnerCopyUnits(source: string, repoPath: string): string[] {
  if (repoPath.endsWith(".json")) {
    return collectJsonClauses(source);
  }

  const ext = extname(repoPath);

  if (ext === ".md" || ext === ".mdx") {
    return collectMdxClauses(source);
  }

  if (ext === ".ts" || ext === ".tsx") {
    return collectTsClauses(source, repoPath);
  }

  return [];
}

function hasForbiddenInquiryQuoteTimePromise(text: string): boolean {
  if (
    FORBIDDEN_INQUIRY_RESPONSE_EXTRA_PATTERNS.some((pattern) =>
      pattern.test(text),
    )
  ) {
    return true;
  }

  if (hasForbiddenExactAccuratePricing12HourPromise(text)) {
    return true;
  }

  return splitCopyClauses(text).some(isForbiddenQuoteTimeClause);
}

function toRepoPath(absolutePath: string): string {
  return relative(process.cwd(), absolutePath).split(sep).join("/");
}

function isPublicSourceFile(repoPath: string): boolean {
  const segments = repoPath.split("/");

  if (segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment))) {
    return false;
  }

  return PUBLIC_SOURCE_EXTENSIONS.has(extname(repoPath));
}

function getPublicSourceFiles(): string[] {
  return PUBLIC_SOURCE_ROOTS.flatMap((root) => walkPublicSourceFiles(root));
}

/**
 * 买家文案面：公开源码文件里去掉样式表。
 *
 * `.css` 是为了扫「这个站不叫这个名字」这类品牌串才进枚举的，样式表本身不向买家
 * 输出文案。下面三条一致性断言（邮箱、注册地址、回复时效）读的是原始文件文本，
 * 让 CSS 进去有两个后果：注释里写个地址或时数就能造成假红，更糟的是回复时效那条
 * 断的是「全站只有一个时数」——真实文案里的时数全被删掉、只剩一条 CSS 注释里的
 * 话，集合大小仍是 1，测试照绿。所以这三条只看真正写文案的文件。
 */
function getBuyerCopyFiles(): string[] {
  return getPublicSourceFiles().filter(
    (filePath) => extname(filePath) !== ".css",
  );
}

function walkPublicSourceFiles(dir: string, results: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test scans fixed repo-local public source roots
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      walkPublicSourceFiles(absolutePath, results);
      continue;
    }

    if (!entry.isFile()) continue;

    const repoPath = toRepoPath(absolutePath);
    if (isPublicSourceFile(repoPath)) {
      results.push(repoPath);
    }
  }

  return results;
}

function readRepoFile(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads paths produced by fixed repo-local scan roots
  return readFileSync(repoPath, "utf8");
}

function readRepoJson(repoPath: string): unknown {
  return JSON.parse(readRepoFile(repoPath)) as unknown;
}

function readRepoJsonc(repoPath: string): unknown {
  const parsed = ts.parseConfigFileTextToJson(repoPath, readRepoFile(repoPath));
  if (parsed.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"),
    );
  }
  return parsed.config as unknown;
}

function getObject(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTruthy();
  expect(typeof value, label).toBe("object");
  expect(Array.isArray(value), label).toBe(false);
  return value as Record<string, unknown>;
}

describe("Tucsenberg Phase 1 site contract", () => {
  it("runs as an English-only site", () => {
    expect(LOCALES_CONFIG.locales).toEqual(["en"]);
    expect(LOCALES_CONFIG.defaultLocale).toBe("en");
    expect(LOCALES_CONFIG.retiredLocales).toEqual(["zh"]);
    expect(getLocaleTimeZone("en")).toBe("UTC");
    expect(getLocaleCurrency("en")).toBe("USD");
  });

  it("uses the approved Phase 1 static URL set", () => {
    const routePaths = [
      getCanonicalPath("home"),
      getCanonicalPath("products"),
      getCanonicalPath("oemWholesale"),
      getCanonicalPath("materialsGuide"),
      getCanonicalPath("specificationsGuide"),
      getCanonicalPath("about"),
      getCanonicalPath("requestQuote"),
      getCanonicalPath("contact"),
      getCanonicalPath("warranty"),
      getCanonicalPath("privacy"),
      getCanonicalPath("terms"),
    ];

    expect(routePaths).toEqual(TARGET_STATIC_PATHS);
  });

  it("maps catalog market slugs to the five Tucsenberg product lines", () => {
    expect(getAllMarketSlugs()).toEqual(TARGET_PRODUCT_SLUGS);
  });

  // 静态页的 routeOwner 存在性由 `static-public-pages-contract.test.ts` 从注册表
  // 逐项验证，这里不再抄一份。它没覆盖的是动态目录路由——那个文件不在
  // `PUBLIC_STATIC_PAGE_DEFINITIONS` 里，删掉它五条产品线全部 404。
  it("keeps an owner file for the dynamic catalog route", () => {
    expect(() =>
      statSync("src/app/[locale]/products/[market]/page.tsx"),
    ).not.toThrow();
  });

  it("keeps required long-form pages in English MDX content files", () => {
    for (const contentFile of TARGET_MDX_PAGES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed content file list
      expect(() => statSync(contentFile), contentFile).not.toThrow();
    }
  });

  it("keeps warranty claims scoped by product type", () => {
    const aboutContent = readRepoFile("content/pages/en/about.mdx");
    const oemContent = readRepoFile("content/pages/en/oem-wholesale.mdx");
    const warrantyContent = readRepoFile("content/pages/en/warranty.mdx");
    for (const content of [aboutContent, oemContent]) {
      const threeYearClaims = content
        .split("\n")
        .filter((line) => /(?:3\s*-?\s*year|three\s*-?\s*year)/iu.test(line));

      expect(threeYearClaims.length).toBeGreaterThan(0);
      for (const claim of threeYearClaims) {
        expect(claim).toMatch(/standard durable product lines/iu);
        expect(claim).toMatch(/consumables/iu);
        expect(claim).toMatch(/product-specific terms/iu);
      }
    }
    expect(warrantyContent).toContain(
      "Standard product lines (TB-BW, TB-AG, TB-TD, TB-CP)",
    );
    expect(warrantyContent).toContain("Consumables (TB-FB absorbent bags");
    expect(warrantyContent).toContain("Shelf-life for unused bags: 3 years");
  });

  it("copies approved PDF downloads into the public download surface", () => {
    for (const downloadFile of TARGET_DOWNLOADS) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed download file list
      expect(() => statSync(downloadFile), downloadFile).not.toThrow();
    }
  });

  // 从 `retiredLocales` 派生，而不是点名 zh：以后再退役一种语言，这条自动跟上。
  // 上面 "runs as an English-only site" 那条仍然钉死 `retiredLocales` 等于 ["zh"]，
  // 那是故意的——语言集合变动必须有人明确改测试。这条只负责目录别偷偷长回来。
  it("ships no content or message directory for a retired locale", () => {
    const retiredDirectories = LOCALES_CONFIG.retiredLocales.flatMap(
      (locale) => [
        `content/pages/${locale}`,
        `messages/${locale}`,
        `messages/base/${locale}`,
        `messages/profiles/b2b-lead/${locale}`,
        `messages/profiles/catalog/${locale}`,
      ],
    );

    expect(retiredDirectories.length).toBeGreaterThan(0);
    for (const directory of retiredDirectories) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks directories derived from the locale registry
      expect(() => statSync(directory), directory).toThrow();
    }
  });

  // `.env.example` 是操作者照抄的模板，这里钉的是抄下来就能跑的那几行。站点地址
  // 写成正面断言而不是「`example.com` 不在里面」：占位域名不止 example.com 一个，
  // 而本地开发该填什么只有一个答案。
  //
  // 断的是解析出来的键值对，不是「文件里有这么一行」。后者堵不住重复定义：正确的
  // 那行留着，底下再写一行同名的错值，正则照样找得到正确那行，而 dotenv 实际生效
  // 的是后面那个。所以每个键都要求只出现一次。
  it("ships an example environment file operators can copy as-is", () => {
    const declarations = new Map<string, string[]>();
    for (const line of readRepoFile(".env.example").split("\n")) {
      const declaration = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
      if (!declaration) continue;
      const key = declaration[1] as string;
      declarations.set(key, [
        ...(declarations.get(key) ?? []),
        declaration[2] as string,
      ]);
    }

    for (const [key, expected] of [
      ["NEXT_PUBLIC_SUPPORTED_LOCALES", "en"],
      ["NEXT_PUBLIC_BASE_URL", "http://localhost:3000"],
      ["NEXT_PUBLIC_SITE_URL", "http://localhost:3000"],
    ] as const) {
      expect(declarations.get(key), key).toEqual([expected]);
    }
  });

  // 原来这条把 wrangler.jsonc 和 single-site.ts 当纯文本扫，找几个字符串在不在。
  // 那判不出东西：`wrangler.jsonc` 里注释也是文本，把主机名写进一行注释就能过；
  // 找到字符串也不说明它落在哪个字段上，preview 的主机名写进 production 照样绿。
  // 另外两条是「`example.com` 不在里面」「指向正式域的兜底写法不在里面」。前者
  // 挪进上面那条并改成正面断言；后者直接删掉，因为
  // `src/config/__tests__/single-site.test.ts` 已经把环境变量清空后 import 这个模块，
  // 断言兜底值就是预览地址——那条比「某个写法不在源码里」严得多。
  //
  // 解析之后按字段断，并且把预览环境里三个必须一致的值绑在一起。真正会出事的是
  // 它们不一致：Turnstile 的允许主机名单漏掉部署主机，预览站上买家一条询盘都发
  // 不出去。表单会照常报一个安全校验失败的提示，所以买家看得见——只是那个提示
  // 长得像买家自己的问题，业主这边看到的只是询盘变成零。
  it("keeps the preview deployment host consistent inside worker config", () => {
    const wrangler = getObject(readRepoJsonc("wrangler.jsonc"), "wrangler");
    expect(wrangler.name).toBe("tucsenberg-site");

    const env = getObject(wrangler.env, "wrangler.env");
    const preview = getObject(env.preview, "wrangler.env.preview");
    const vars = getObject(preview.vars, "wrangler.env.preview.vars");

    const siteUrl =
      "https://tucsenberg-site-preview.faints-pudgier-9r.workers.dev";
    expect(vars["NEXT_PUBLIC_SITE_URL"]).toBe(siteUrl);
    expect(vars["NEXT_PUBLIC_BASE_URL"]).toBe(siteUrl);

    // 先确认它真是字符串。wrangler 的 vars 允许写数组，而 `String(["a"])` 得到
    // `"a"`，逗号切开照样能对上——运行时那边只按字符串读，那种写法是坏的，这里
    // 却会绿。
    const allowedHosts = vars["TURNSTILE_ALLOWED_HOSTS"];
    expect(typeof allowedHosts).toBe("string");
    expect(String(allowedHosts).split(",")).toContain(new URL(siteUrl).host);
  });

  it("keeps the local build fallback aligned with the preview Turnstile site key", () => {
    const wrangler = getObject(readRepoJsonc("wrangler.jsonc"), "wrangler");
    const env = getObject(wrangler.env, "wrangler.env");
    const preview = getObject(env.preview, "wrangler.env.preview");
    const vars = getObject(preview.vars, "wrangler.env.preview.vars");
    const declarations = readRepoFile(".env.production")
      .split("\n")
      .flatMap((line) => {
        const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
        return match ? [[match[1], match[2]] as const] : [];
      });

    expect(
      declarations.filter(([key]) => key === "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    ).toEqual([
      ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY],
    ]);
  });

  it("keeps formal domain cutover out of the no-cutover production config", () => {
    const wrangler = getObject(readRepoJsonc("wrangler.jsonc"), "wrangler");
    const env = getObject(wrangler.env, "wrangler.env");
    const production = getObject(env.production, "wrangler.env.production");
    const vars = getObject(production.vars, "wrangler.env.production.vars");

    expect(production).not.toHaveProperty("routes");
    expect(production).not.toHaveProperty("custom_domain");
    expect(production).not.toHaveProperty("workers_dev");
    expect(vars.NEXT_PUBLIC_SITE_URL).not.toBe("https://tucsenberg.com");
    expect(vars.NEXT_PUBLIC_BASE_URL).not.toBe("https://tucsenberg.com");
  });

  it("keeps forbidden claims out of public-rendered source surfaces", () => {
    const offenders: string[] = [];

    for (const filePath of getPublicSourceFiles()) {
      const source = readRepoFile(filePath);

      for (const pattern of FORBIDDEN_PUBLIC_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push(`${filePath} :: ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps active homepage and catalog message structure", () => {
    for (const messageFile of ACTIVE_HOMEPAGE_MESSAGE_FILES) {
      const messages = getObject(readRepoJson(messageFile), messageFile);
      const home = getObject(messages.home, `${messageFile} home`);
      getObject(home.hero, `${messageFile} home.hero`);
      const catalog = getObject(messages.catalog, `${messageFile} catalog`);
      getObject(catalog.overview, `${messageFile} catalog.overview`);
      const markets = getObject(
        catalog.markets,
        `${messageFile} catalog.markets`,
      );

      expect(Object.keys(markets), messageFile).toEqual(TARGET_PRODUCT_SLUGS);

      // 产品线和买家类别的标题手写钉在这里。首页测试渲染时是从消息包取值比对
      // 的，那只证明 key 接线正确，改文案它跟着改；逐字真值必须有一处手写，
      // 就是这里。
      //
      // 下面钉的是消息文件里的书写顺序，不是页面上卡片的先后。决定卡片先后的是
      // 生产配置 `SINGLE_SITE_HOME_PRODUCT_LINES`，它的顺序在
      // `src/config/__tests__/single-site-page-expression.test.ts` 的
      // "keeps homepage semantic tuples aligned with the live page runtime"
      // 里手写钉着（把配置里两项对调会让那条变红，已验证）。两处各钉一件事。
      const productLines = getObject(
        home.productLines,
        `${messageFile} home.productLines`,
      );
      const productLineItems = getObject(
        productLines.items,
        `${messageFile} home.productLines.items`,
      );
      const buyerSegments = getObject(
        home.buyerSegments,
        `${messageFile} home.buyerSegments`,
      );
      const buyerSegmentItems = getObject(
        buyerSegments.items,
        `${messageFile} home.buyerSegments.items`,
      );

      expect(
        Object.entries(productLineItems).map(([key, item]) => [
          key,
          getObject(item, `${messageFile} home.productLines.items.${key}`)
            .title,
        ]),
        messageFile,
      ).toEqual([
        ["absFloodBarriers", "ABS Interlocking Boxwall — TB-BW series"],
        ["aluminumFloodGates", "Aluminum Flood Gates — TB-AG series"],
        ["absorbentFloodBags", "Absorbent Flood Bags — TB-FB series"],
        ["floodTubeDams", "Water & Air-Filled Tube Dams — TB-TD series"],
        ["frpFloodBarriers", "FRP Composite Planks — TB-CP series"],
      ]);
      expect(
        Object.entries(buyerSegmentItems).map(([key, item]) => [
          key,
          getObject(item, `${messageFile} home.buyerSegments.items.${key}`)
            .title,
        ]),
        messageFile,
      ).toEqual([
        ["dealersDistributors", "Dealers & Distributors"],
        ["importersBrands", "Importers & Brands (OEM)"],
        ["contractorsProjects", "Contractors & Projects"],
        ["smallBusinessBuyers", "Small Business Buyers"],
      ]);
    }
  });

  it.each(FORBIDDEN_QUOTE_TIME_FIXTURES)(
    "flags forbidden quote-time promise copy: $label",
    ({ text, repoPath }) => {
      const source = quoteTimeFixtureSource(text, repoPath);
      expect(
        collectOwnerCopyUnits(source, repoPath).some(
          hasForbiddenInquiryQuoteTimePromise,
        ),
      ).toBe(true);
    },
  );

  it.each(ALLOWED_QUOTE_TIME_FIXTURES)(
    "allows non-quote SLA timing copy: $label",
    ({ text, repoPath }) => {
      const source = quoteTimeFixtureSource(text, repoPath);
      expect(
        collectOwnerCopyUnits(source, repoPath).some(
          hasForbiddenInquiryQuoteTimePromise,
        ),
      ).toBe(false);
    },
  );

  it("covers inquiry quote-time copy through the shared public-source enumeration", () => {
    const scannedFiles = getPublicSourceFiles();

    for (const root of PUBLIC_SOURCE_ROOTS) {
      expect(
        scannedFiles.some((filePath) => filePath.startsWith(`${root}/`)),
        root,
      ).toBe(true);
    }

    expect(scannedFiles).toContain("src/lib/contact/getContactCopy.ts");

    // 射程本身要钉住，否则缩小它不会让任何断言变红：下面那些禁用文案的循环只会
    // 少读几个文件，一条都不会失败。`globals.css` 的启动器注释就是这么撑过整轮
    // 退役的。
    //
    // 钉的是「至少有一个 .css 进了枚举」，不是某个具体路径：全局样式表将来搬到
    // `src/styles/globals.css` 是一次正当迁移，不该因此变红。
    expect(
      scannedFiles.filter((filePath) => filePath.endsWith(".css")),
      "no .css reached the scan",
    ).not.toEqual([]);
    // 根收窄同样是静默缩小：把 `src` 换成 `src/app` 后每个根仍有文件、上面几条
    // 也仍然通过，但 `src/components` 和 `src/config` 已经悄悄退出扫描。
    expect(PUBLIC_SOURCE_ROOTS).toEqual(["src", "content", "messages"]);
  });

  it("keeps misleading inquiry quote-time promises out of live owner copy", () => {
    const offenders: string[] = [];

    for (const filePath of getBuyerCopyFiles()) {
      const source = readRepoFile(filePath);

      for (const copyUnit of collectOwnerCopyUnits(source, filePath)) {
        if (hasForbiddenInquiryQuoteTimePromise(copyUnit)) {
          offenders.push(`${filePath} :: ${copyUnit}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("uses the approved inquiry success and reply promise on key surfaces", () => {
    const b2bLead = getObject(
      readRepoJson("messages/profiles/b2b-lead/en/messages.json"),
      "b2b-lead messages",
    );
    const inquiry = getObject(b2bLead.inquiry, "b2b-lead inquiry");
    const form = getObject(inquiry.form, "b2b-lead inquiry.form");
    const success = form.success;

    expect(typeof success, "inquiry.form.success").toBe("string");
    const successText = String(success);
    expect(successText).toMatch(/reply within 12 hours/i);
    expect(successText).toMatch(/details are sufficient/i);
    expect(successText).toMatch(/reply includes a quote/i);
    expect(successText).toMatch(/missing essentials/i);

    const turnstile = getObject(
      form.turnstile,
      "b2b-lead inquiry.form.turnstile",
    );
    expect(String(turnstile.rescueAfterEmail)).toMatch(
      /reply within 12 hours/i,
    );

    // 这里原本还扫了 turnstile-rescue-line.tsx 的源码，要求出现 "afterEmail"、
    // 不出现写死的 "Reply within 12 hours"。把 afterEmail 留在 interface 或一个
    // 没人用的变量里、同时不再渲染它，那两条照样绿。
    // `lazy-turnstile.test.tsx` 里真的渲染了失败态，断言页面上出现
    // `labels.rescueAfterEmail`，那才是这句文案还活着的证据。
  });

  it("states the configured contact facts on the contact page", () => {
    const configuredEmail = getPublicContactEmail();
    const contactPage = readRepoFile("content/pages/en/contact.mdx");

    expect(configuredEmail, "site config contact email").toBeTypeOf("string");
    expect(contactPage).toContain(configuredEmail!);
    expect(contactPage).toContain(TUCSENBERG_REGISTERED_ADDRESS);
    expect(contactPage).toMatch(/\[RFQ form\]\(\/request-quote\)/u);
    expect(hasPlaceholderCopy(contactPage)).toBe(false);
  });

  // The email, the registered address and the reply window are each written by
  // hand on several surfaces. Freezing one copy's wording proved nothing: the
  // owner changing a fact in config would leave every other surface stale and
  // green. These three assert agreement instead of wording.
  it("states one contact email across every buyer-visible surface", () => {
    const configured = getPublicContactEmail();
    const offenders: string[] = [];

    for (const filePath of getBuyerCopyFiles()) {
      for (const found of readRepoFile(filePath).matchAll(
        TUCSENBERG_EMAIL_PATTERN,
      )) {
        if (found[0] !== configured)
          offenders.push(`${filePath} :: ${found[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("states one registered address across every buyer-visible surface", () => {
    const offenders: string[] = [];

    for (const filePath of getBuyerCopyFiles()) {
      const source = readRepoFile(filePath);

      if (
        source.includes(REGISTERED_ADDRESS_ANCHOR) &&
        !source.includes(TUCSENBERG_REGISTERED_ADDRESS)
      ) {
        offenders.push(filePath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("states one reply window across every buyer-visible surface", () => {
    const windows = new Map<string, string[]>();

    for (const filePath of getBuyerCopyFiles()) {
      for (const found of readRepoFile(filePath).matchAll(
        REPLY_WINDOW_PATTERN,
      )) {
        const hours = found[1]!;
        windows.set(hours, [...(windows.get(hours) ?? []), filePath]);
      }
    }

    expect(windows.size, `reply windows found: ${[...windows.keys()]}`).toBe(1);
    // 「只有一个时数」自己不够：真实文案里的时数全被删掉、只剩某个边角文件里
    // 写着一处，集合大小仍然是 1，这条照绿。所以还要求它出现在买家一定会读到
    // 的两个面上——联系页和在用的消息包。
    const [carriers] = [...windows.values()];
    expect(carriers).toContain("content/pages/en/contact.mdx");
    expect(carriers).toContain("messages/profiles/catalog/en/messages.json");
  });
});
