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
