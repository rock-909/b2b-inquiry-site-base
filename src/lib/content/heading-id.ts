/**
 * Markdown heading → anchor id 的纯字符串解析规则。
 *
 * 渲染器（H2/H3 锚点）与内容加载器（目录提取）是它的两个真实调用方，
 * 因此独立成无 React 的叶子模块：内容读取不需要为此拖入渲染依赖图。
 */

const EXPLICIT_ID_PATTERN = /\s*\\?\{#([a-z0-9-]+)\\?\}\s*$/;

function slugifyHeading(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") {
    return "";
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function parseHeadingId(text: string): {
  displayText: string;
  id: string;
} {
  const match = EXPLICIT_ID_PATTERN.exec(text);
  if (match) {
    return {
      displayText: text.slice(0, match.index).trim(),
      id: match[1] ?? "",
    };
  }
  return { displayText: text, id: slugifyHeading(text) };
}
