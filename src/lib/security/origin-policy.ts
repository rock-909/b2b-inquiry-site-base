/** 本站表单只向当前 origin 提交；无 Origin 的非浏览器请求仍需其余反滥用检查。 */
export function isSameOrigin(
  origin: string | null,
  requestUrl: string,
): boolean {
  if (origin === null) return true;
  try {
    const source = new URL(origin);
    const target = new URL(requestUrl);
    return (
      (source.protocol === "https:" || source.protocol === "http:") &&
      source.origin === target.origin &&
      source.href === `${source.origin}/`
    );
  } catch {
    return false;
  }
}
