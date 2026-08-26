/**
 * 询盘字段错误协议的唯一真相源。
 *
 * wire 上的一条字段错误 detail 形如 errors.<field>.<leaf>；服务端 mapper、
 * 客户端字段匹配和 copy 类型全部从这里派生，新增 detail 只改 PROTOCOL 常量。
 * 本模块必须保持 client-safe：只允许纯常量与纯类型，禁止引入 zod、env、
 * logger、server-only 或 React——否则客户端 import 会把服务端依赖拖进包。
 */

const ERROR_KEY_PREFIX = "errors";

export const INQUIRY_FIELD_ERROR_PROTOCOL = {
  fullName: ["required", "invalid", "tooLong"],
  email: ["required", "invalid", "tooLong"],
  message: ["invalid", "tooLong"],
} as const;

export type InquiryErrorField = keyof typeof INQUIRY_FIELD_ERROR_PROTOCOL;

export type InquiryErrorLeaf<Field extends InquiryErrorField> =
  (typeof INQUIRY_FIELD_ERROR_PROTOCOL)[Field][number];

/** wire 上的一条可见字段错误 detail，例如 errors.fullName.required。 */
export type InquiryFieldErrorDetail = {
  [Field in InquiryErrorField]: `errors.${Field}.${InquiryErrorLeaf<Field>}`;
}[InquiryErrorField];

/** 客户端字段错误文案对象的完整性合同：每个字段、每个 leaf 都必须有文案。 */
export type InquiryFieldErrorCopyMap = {
  readonly [Field in InquiryErrorField]: {
    readonly [Leaf in InquiryErrorLeaf<Field>]: string;
  };
};

function fieldErrorPrefixes<Field extends InquiryErrorField>(
  field: Field,
): `errors.${Field}` {
  return `${ERROR_KEY_PREFIX}.${field}`;
}

function wireDetails<Field extends InquiryErrorField>(
  field: Field,
): readonly `errors.${Field}.${InquiryErrorLeaf<Field>}`[] {
  return INQUIRY_FIELD_ERROR_PROTOCOL[field].map(
    (leaf) => `${ERROR_KEY_PREFIX}.${field}.${leaf}` as const,
  );
}

/**
 * 字段名单在这里展开一次（leaf 清单仍由 PROTOCOL 单源派生）；泛型返回值保证
 * 每个 key 的数组元素类型逐字段精确，不需要任何断言。
 */
// 显式标注 Record<InquiryErrorField, …>：协议新增字段而这里漏写时，
// type-check 直接失败——这就是字段名单的 exhaustive 封口。
export const INQUIRY_FIELD_ERROR_KEYS: Record<
  InquiryErrorField,
  `errors.${InquiryErrorField}`
> = {
  fullName: fieldErrorPrefixes("fullName"),
  email: fieldErrorPrefixes("email"),
  message: fieldErrorPrefixes("message"),
};

export const INQUIRY_FIELD_WIRE_DETAILS: Record<
  InquiryErrorField,
  readonly InquiryFieldErrorDetail[]
> = {
  fullName: wireDetails("fullName"),
  email: wireDetails("email"),
  message: wireDetails("message"),
};

/** 服务端可渲染、客户端可内联展示的全部字段错误 detail。 */
export const INQUIRY_FIELD_ERROR_DETAILS = [
  ...INQUIRY_FIELD_WIRE_DETAILS.fullName,
  ...INQUIRY_FIELD_WIRE_DETAILS.email,
  ...INQUIRY_FIELD_WIRE_DETAILS.message,
] as readonly InquiryFieldErrorDetail[];

/**
 * wire detail → 对应 leaf 的精确查找表。客户端用它替代字符串拆解（split），
 * 服务端字段名单在这里逐项封口：协议新增 leaf 而这里漏写时，type-check 直接红。
 */
export const INQUIRY_FIELD_WIRE_DETAIL_LEAVES: {
  readonly [Field in InquiryErrorField]: Readonly<
    Record<string, InquiryErrorLeaf<Field> | undefined>
  > & {
    readonly [
      D in `errors.${Field & string}.${InquiryErrorLeaf<Field>}`
    ]: InquiryErrorLeaf<Field>;
  };
} = {
  fullName: {
    "errors.fullName.required": "required",
    "errors.fullName.invalid": "invalid",
    "errors.fullName.tooLong": "tooLong",
  },
  email: {
    "errors.email.required": "required",
    "errors.email.invalid": "invalid",
    "errors.email.tooLong": "tooLong",
  },
  message: {
    "errors.message.invalid": "invalid",
    "errors.message.tooLong": "tooLong",
  },
};
