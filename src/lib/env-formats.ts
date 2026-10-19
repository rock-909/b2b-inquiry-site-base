/**
 * 环境变量格式规则：运行时 env schema 与上线门禁（production-config.js）共用，
 * 让坏格式在部署前被拦住，而不是在模块加载时让询盘全部 500。
 * 本文件不能有副作用，门禁会直接 require 它。
 */

import { email, enum as zEnum, string } from "zod";

const SENDER_WITH_NAME = /^([^<>]+)<([^<>]+)>$/u;

const FIRST_PRINTABLE_ASCII = 0x20;
const DEL = 0x7f;
const LAST_C1_CONTROL = 0x9f;

// C0、DEL、C1 控制字符（含 CR、LF、NUL）不能进入邮件头。
function hasControlCharacter(value: string): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return (
      code < FIRST_PRINTABLE_ASCII || (code >= DEL && code <= LAST_C1_CONTROL)
    );
  });
}

// Resend 接受裸地址，也接受 "Display Name <addr@domain>"。
export const emailSenderSchema = string().refine((value) => {
  if (hasControlCharacter(value)) return false;
  const match = SENDER_WITH_NAME.exec(value);
  if (match && !match[1]?.trim()) return false;
  return email().safeParse(match ? match[2] : value).success;
}, "Expected an email address or Display Name <address>");

export const emailAddressSchema = email();

export const logLevelSchema = string()
  .transform((value) => value.toLowerCase())
  .pipe(zEnum(["error", "warn", "info", "debug"]));
