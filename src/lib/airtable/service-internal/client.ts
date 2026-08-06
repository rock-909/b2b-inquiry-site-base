import "server-only";

// 动态引入 Airtable，避免构建期和初始化顺序问题
// import type 仅用于类型提示，实际模块在运行时按需加载
import type AirtableNS from "airtable";

export interface AirtableLike {
  base: (id: string) => AirtableNS.Base;
  configure: (opts: {
    endpointUrl: string;
    apiKey: string;
    requestTimeout?: number;
  }) => void;
}

export function resolveAirtableModule(mod: unknown): AirtableLike | null {
  const maybe = mod as
    { default?: Partial<AirtableLike> } | Partial<AirtableLike>;
  const candidate =
    (maybe as { default?: Partial<AirtableLike> }).default ?? maybe;

  if (
    candidate &&
    (typeof candidate === "object" || typeof candidate === "function") &&
    "base" in candidate &&
    "configure" in candidate &&
    typeof (candidate as AirtableLike).base === "function" &&
    typeof (candidate as AirtableLike).configure === "function"
  ) {
    return candidate as AirtableLike;
  }

  return null;
}
