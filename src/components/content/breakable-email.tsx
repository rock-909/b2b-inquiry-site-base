// 在 @ 后留一个断行点：地址放不下时先在 @ 处换行，再按 overflow-wrap 处理过长的片段。
// <wbr> 不进入复制出的文本，不影响 mailto 和读屏。
export function BreakableEmail({ email }: { email: string }) {
  const at = email.lastIndexOf("@");
  if (at < 0) return email;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}
