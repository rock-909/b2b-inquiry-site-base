import { describe, expect, it, vi } from "vitest";
import { OTHER_LOCALE } from "@/test/two-locales";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

// 非默认语言用固定双语 fixture，派生站去掉 es 时这里不用改。
vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

const BASE_GENERAL_INQUIRY = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Jane Buyer",
  email: "jane@example.com",
} as const;

const GENERAL_INQUIRY = {
  ...BASE_GENERAL_INQUIRY,
  message: "Need a custom component for a warehouse project.",
} as const;
describe("inquiryLeadSchema", () => {
  it("accepts a general inquiry without offering identity", () => {
    const result = inquiryLeadSchema.parse(GENERAL_INQUIRY);

    expect(result).toEqual(GENERAL_INQUIRY);
  });

  it("accepts omitted buyer text", () => {
    expect(inquiryLeadSchema.safeParse(BASE_GENERAL_INQUIRY).success).toBe(
      true,
    );
  });

  it.each([[null], [true], [42], [[]], [{}]])(
    "rejects invalid message input %j",
    (message) => {
      expect(
        inquiryLeadSchema.safeParse({
          ...BASE_GENERAL_INQUIRY,
          message,
        }).success,
      ).toBe(false);
    },
  );

  it("preserves canonical multiline message and attribution", () => {
    const result = inquiryLeadSchema.parse({
      ...GENERAL_INQUIRY,
      message: "Line one\nLine two",
      utmSource: "google",
      landingPage: "/contact",
    });

    expect(result.message).toBe("Line one\nLine two");
    expect(result.utmSource).toBe("google");
    expect(result.landingPage).toBe("/contact");
  });

  it("accepts only configured locales and well-formed click ids", () => {
    expect(
      inquiryLeadSchema.parse({ ...GENERAL_INQUIRY, locale: OTHER_LOCALE })
        .locale,
    ).toBe(OTHER_LOCALE);
    // 语言和 gclid 会进业主邮件，自由文本和畸形值在信任边界上拒绝。
    for (const extra of [
      { locale: "fr" },
      { locale: "Español <b>" },
      { gclid: "abc<script>" },
      { gclid: "a".repeat(257) },
      { wbraid: "a b" },
      { gbraid: "a".repeat(257) },
    ]) {
      expect(
        inquiryLeadSchema.safeParse({ ...GENERAL_INQUIRY, ...extra }).success,
      ).toBe(false);
    }
  });

  it.each([
    ["punycode TLD", "buyer@example.xn--p1ai"],
    ["uppercase punycode TLD", "buyer@example.XN--P1AI"],
    ["mixed-case punycode prefix Xn", "buyer@example.Xn--p1ai"],
    ["mixed-case punycode prefix xN", "buyer@example.xN--p1ai"],
    ["ampersand in local part", "r&d@example.com"],
    ["hash in local part", "sales#eu@example.com"],
  ])("accepts a browser-valid address with %s", (_label, email) => {
    const result = inquiryLeadSchema.safeParse({
      ...BASE_GENERAL_INQUIRY,
      email,
    });

    expect(result.success).toBe(true);
    // 小写化只在 schema 做：owner 邮件与 Airtable 都直接使用这个值。
    expect(result.data?.email).toBe(email.toLowerCase());
  });

  it.each([
    ["dotless domain", "a@b"],
    ["single-letter TLD", "a@example.c"],
    ["formula prefix =", "=cmd@example.com"],
    ["formula prefix +", "+cmd@example.com"],
    ["formula prefix -", "-cmd@example.com"],
    ["formula prefix @", "@cmd@example.com"],
    ["empty punycode label", "a@example.xn--"],
  ])("rejects an address with %s", (_label, email) => {
    expect(
      inquiryLeadSchema.safeParse({ ...BASE_GENERAL_INQUIRY, email }).success,
    ).toBe(false);
  });
});
