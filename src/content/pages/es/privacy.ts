import type { Page } from "@/types/content.types";

const privacyPage = {
  slug: "privacy",
  filePath: "/src/content/pages/es/privacy.ts",
  metadata: {
    title: "Referencia de política de privacidad",
    description:
      "Texto de referencia no destinado a producción para documentar cómo un sitio B2B gestiona la información enviada.",
    slug: "privacy",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "legal",
    showToc: true,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Referencia de política de privacidad",
      description:
        "Texto de referencia que debe revisarse y sustituirse según la empresa, las herramientas, los datos y la jurisdicción reales.",
    },
  },
  content: String.raw`
> Solo como referencia. Esto no es asesoramiento jurídico ni una política de privacidad para producción. La empresa operativa debe sustituirlo y revisarlo según sus herramientas, flujos de datos y jurisdicciones reales.

## Responsable del sitio

Identifica la entidad legal que opera el sitio web, sus datos de contacto y cualquier representante exigido por la jurisdicción aplicable.

## Información recopilada

Describe los campos enviados mediante el formulario de consulta y cualquier dato técnico, de seguridad, análisis o campaña que el sitio desplegado recopile realmente.

## Finalidad y uso compartido

Explica por qué la empresa utiliza los datos de consulta, qué proveedores de servicios los reciben y si se usan para seguimiento comercial, presupuestos, cumplimiento o medición.

## Conservación y solicitudes

Indica la política real de conservación y proporciona un medio de contacto operativo para las solicitudes de acceso, rectificación o eliminación.

## Cookies y análisis

Enumera únicamente el almacenamiento y las integraciones activadas en el entorno desplegado. El consentimiento debe coincidir con la configuración real del sitio.
`,
} satisfies Page;

export default privacyPage;
