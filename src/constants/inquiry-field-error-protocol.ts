/**
 * 询盘字段错误协议的真相源。
 *
 * wire 上的一条字段错误 detail 形如 errors.<field>.<leaf>。可渲染 detail 清单
 * 与 detail 类型都从 PROTOCOL 派生；新增 detail 时还要同步服务端 mapper 的
 * 按字段分支（inquiry-validation-details.ts）和客户端文案表（inquiry-form-copy.ts，
 * 漏写时 type-check 报错）。
 * 本模块必须保持 client-safe：只允许纯常量与纯类型，禁止引入 zod、env、
 * logger、server-only 或 React——否则客户端 import 会把服务端依赖拖进包。
 */

export const INQUIRY_FIELD_ERROR_PROTOCOL = {
  fullName: ["required", "invalid", "tooLong"],
  email: ["required", "invalid", "tooLong"],
  message: ["invalid", "tooLong"],
} as const;

export type InquiryErrorField = keyof typeof INQUIRY_FIELD_ERROR_PROTOCOL;

type InquiryErrorLeaf<Field extends InquiryErrorField> =
  (typeof INQUIRY_FIELD_ERROR_PROTOCOL)[Field][number];

/** wire 上的一条可见字段错误 detail，例如 errors.fullName.required。 */
export type InquiryFieldErrorDetail = {
  [Field in InquiryErrorField]: `errors.${Field}.${InquiryErrorLeaf<Field>}`;
}[InquiryErrorField];

/** 服务端可渲染、客户端可内联展示的全部字段错误 detail。 */
export const INQUIRY_FIELD_ERROR_DETAILS = (
  Object.keys(INQUIRY_FIELD_ERROR_PROTOCOL) as InquiryErrorField[]
).flatMap((field) =>
  INQUIRY_FIELD_ERROR_PROTOCOL[field].map(
    (leaf) => `errors.${field}.${leaf}` as InquiryFieldErrorDetail,
  ),
);
