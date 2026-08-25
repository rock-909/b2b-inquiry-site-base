import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { SINGLE_SITE_FACTS } from "@/config/single-site";

/**
 * 首页内容区 / 产品详情页共用的内嵌询盘表单区块。
 *
 * 与 /contact 的区别只有两个 prop：区块标题文案与产品语境预填；
 * 表单组件、静态兜底、提交端点与安全链路完全同一份。
 * 本文件是表单入口边界的一部分（contact-entry-boundary 契约覆盖）：
 * 必须直接渲染 InquiryForm，不得再包一层会吞掉请求地址的抽象。
 */
export function EmbeddedInquiryFormSection({
  id,
  title,
  description,
  initialMessage,
  messages,
}: {
  /** 产品详情页传 "inquiry" 供页内 CTA 锚点定位；放在 SSR 外层 section 上，无 JS 可用。 */
  id?: string;
  title: string;
  description?: string;
  /** 仅产品详情页传入：来自 i18n 模板 × 编译期产品名，非用户输入。 */
  initialMessage?: string;
  messages: Record<string, unknown>;
}) {
  const inquiryCopy = createInquiryFormCopyFromMessages(
    messages,
    SINGLE_SITE_FACTS.contact.email,
  );
  const inquiryFallback = <InquiryFormStaticFallback copy={inquiryCopy} />;

  return (
    <section
      {...(id ? { id } : {})}
      className="section-divider px-6 py-14 md:py-[72px]"
    >
      <div className="mx-auto max-w-[720px]">
        <h2 className="text-section text-balance">{title}</h2>
        {description ? (
          <p className="mt-3 text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
        <div className="mt-8">
          <InquiryForm
            copy={inquiryCopy}
            fallback={inquiryFallback}
            {...(initialMessage ? { initialMessage } : {})}
          />
        </div>
      </div>
    </section>
  );
}
