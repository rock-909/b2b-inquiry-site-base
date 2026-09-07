import type { Page } from "@/types/content.types";

const aboutPage = {
  slug: "about",
  filePath: "/src/content/pages/es/about.ts",
  metadata: {
    title: "Sobre este sitio de referencia",
    description:
      "Página de referencia neutral sobre la identidad, el modelo operativo y las pruebas que debe ofrecer un futuro sitio B2B.",
    slug: "about",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "legal",
    showToc: true,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Sobre este sitio de referencia para consultas B2B",
      description:
        "Contenido de referencia sobre la identidad, el modelo operativo y las pruebas que debe explicar una empresa futura.",
    },
  },
  content: String.raw`
Este es **contenido de referencia para un sitio B2B reutilizable**, no una descripción de una empresa real. Sustitúyelo por datos confirmados por el responsable antes de cualquier despliegue en producción.

## Indica con quién trata el comprador

Nombra la entidad legal, el nombre comercial, la ubicación y el papel en la cadena de suministro. Mantén coherentes el sitio web, la oferta, la factura y el beneficiario del pago.

## Explica cómo funciona la empresa

Describe qué fabrica, suministra o coordina la empresa. Haz que sea fácil comprobar qué trabajo se realiza internamente, qué hacen los socios y qué corresponde al comprador.

## Muestra pruebas útiles

Usa pruebas que el comprador pueda comprobar: especificaciones aprobadas, muestras, opciones de inspección, registros de proyectos, certificaciones o compromisos de servicio por escrito. No publiques afirmaciones que el responsable no pueda respaldar.

## Indica el siguiente paso

El sitio debe terminar con un único camino claro: **[iniciar una consulta](/contact)** con los datos necesarios para ofrecer una respuesta útil.
`,
} satisfies Page;

export default aboutPage;
