import {
  discriminatedUnion,
  email,
  literal,
  number,
  object,
  prettifyError,
  string,
  union,
  type ZodType,
} from "zod";

// 只校验格式：留空即不展示，占位判断只在上线门禁里做。
const blankOr = (schema: ZodType<string>) =>
  union([schema, literal("")]).optional();

const httpsUrl = string().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an https URL");

// 留空表示不展示；纯空白既不是"留空"也不是可展示的文字。
const notWhitespaceOnly = string().refine(
  (value) => value === "" || value.trim() !== "",
  "must not be whitespace only",
);

const rootRelativePath = string().regex(
  /^\/(?!\/)[^\s\\]+$/u,
  "must be a root-relative path",
);

const phone = string()
  .regex(/^\+?[\d\s().-]{7,25}$/u, "must be a phone number")
  .refine((value) => (value.match(/\d/gu) ?? []).length >= 7, "too few digits");

// wa.me 只认带国家码的号码：要求 + 开头，E.164 最多 15 位数字。
const WHATSAPP_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;
const whatsapp = string()
  .regex(/^\+[1-9][\d\s().-]{6,24}$/u, "must be an international number")
  .refine((value) => {
    const digits = (value.match(/\d/gu) ?? []).length;
    return digits >= WHATSAPP_MIN_DIGITS && digits <= E164_MAX_DIGITS;
  }, "must have 8-15 digits");

const readyLogo = object({
  status: literal("ready"),
  horizontal: rootRelativePath,
  width: number().int().positive(),
  height: number().int().positive(),
});

const siteIdentitySchema = object({
  name: notWhitespaceOnly,
  description: notWhitespaceOnly,
  seo: object({
    titleTemplate: notWhitespaceOnly,
    defaultTitle: notWhitespaceOnly,
    defaultDescription: notWhitespaceOnly,
  }),
  company: object({
    established: number()
      .int()
      .positive()
      .max(new Date().getFullYear())
      .optional(),
  }).optional(),
  contact: object({
    email: blankOr(email()),
    phone: blankOr(phone),
    whatsapp: blankOr(whatsapp),
  }),
  social: object({
    linkedin: blankOr(httpsUrl),
    twitter: blankOr(httpsUrl),
  }),
  brandAssets: object({
    ogImage: union([rootRelativePath, httpsUrl]),
    favicon: union([rootRelativePath, httpsUrl]),
    logo: discriminatedUnion("status", [
      readyLogo,
      object({ status: literal("pending") }),
    ]).optional(),
  }),
});

export function assertValidSiteConfig(config: object): void {
  const result = siteIdentitySchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid site config:\n${prettifyError(result.error)}`);
  }
}

// 路径格式合法不代表文件存在：缺文件时页头只会显示破图。
// publicAssetPaths 是 next.config 在构建时列出的 public/ 真实文件；
// 不在 Next 构建里（脚本、单测）时没有清单，跳过。
export function assertLogoFileExists(
  config: { brandAssets: { logo?: { status: string; horizontal?: string } } },
  publicAssetPaths: readonly string[] | undefined,
): void {
  const { logo } = config.brandAssets;
  if (!publicAssetPaths || logo?.status !== "ready" || !logo.horizontal) return;
  if (!publicAssetPaths.includes(logo.horizontal)) {
    throw new Error(
      `Invalid site config: brandAssets.logo.horizontal "${logo.horizontal}" does not exist in public/. Add the file or remove the logo.`,
    );
  }
}
