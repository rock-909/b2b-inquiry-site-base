import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import type { Locale } from "@/i18n/routing-config";

export interface OfferingCopy {
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly applications: readonly string[];
  readonly specifications: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly materials: readonly string[];
  readonly configuration: readonly string[];
  readonly delivery: readonly string[];
  readonly evidence: readonly string[];
}

export interface Offering extends OfferingCopy {
  readonly id: string;
  readonly updatedAt: string;
  readonly translations?: Readonly<Record<string, OfferingCopy>>;
}

export const OFFERINGS = [
  {
    id: "sample-offering",
    name: "Sample Offering",
    summary: "A neutral catalog example for a derived B2B product line.",
    description:
      "Replace this reference entry with verified product facts, applications and buyer guidance before launch.",
    applications: [
      "Name the operating environments and buyer problems this product is designed to address.",
      "State who normally evaluates, specifies, purchases or installs the product.",
      "Explain the conditions where another product or configuration would be more suitable.",
    ],
    specifications: [
      {
        label: "Dimensions or capacity",
        value:
          "Add the verified range, units, tolerances and selection limits.",
      },
      {
        label: "Operating conditions",
        value:
          "State the approved temperature, pressure, load or environment limits.",
      },
      {
        label: "Standards and options",
        value:
          "List only documented standards, grades, sizes and available options.",
      },
    ],
    materials: [
      "Identify the verified material grades, finishes, coatings or construction methods.",
      "Explain how material choices affect service life, maintenance or application fit.",
    ],
    configuration: [
      "Describe the information required to select or configure the product correctly.",
      "Separate standard options from custom engineering or project-specific review.",
    ],
    delivery: [
      "State packaging, order quantity, lead-time and destination constraints only when confirmed.",
      "Clarify which installation, commissioning, documentation or after-sales services are included.",
    ],
    evidence: [
      "Link approved datasheets, drawings, test reports, certificates or project records.",
      "Do not use illustrations, badges or unsupported claims as substitutes for evidence.",
    ],
    translations: {
      es: {
        name: "Oferta de ejemplo",
        summary:
          "Un ejemplo de catálogo neutral para una línea de productos B2B derivada.",
        description:
          "Sustituye esta entrada de referencia por datos verificados del producto, sus aplicaciones y la orientación para compradores antes del lanzamiento.",
        applications: [
          "Indica los entornos de trabajo y los problemas del comprador que este producto debe resolver.",
          "Explica quién suele evaluar, especificar, comprar o instalar el producto.",
          "Aclara cuándo otro producto o configuración sería más adecuado.",
        ],
        specifications: [
          {
            label: "Dimensiones o capacidad",
            value:
              "Añade el rango verificado, las unidades, las tolerancias y los límites de selección.",
          },
          {
            label: "Condiciones de funcionamiento",
            value:
              "Indica los límites aprobados de temperatura, presión, carga o entorno.",
          },
          {
            label: "Normas y opciones",
            value:
              "Enumera únicamente las normas, calidades, tamaños y opciones disponibles que estén documentados.",
          },
        ],
        materials: [
          "Identifica los grados de material, acabados, recubrimientos o métodos de construcción verificados.",
          "Explica cómo las opciones de material afectan a la vida útil, el mantenimiento o la adecuación a la aplicación.",
        ],
        configuration: [
          "Describe la información necesaria para seleccionar o configurar correctamente el producto.",
          "Separa las opciones estándar de la ingeniería personalizada o la revisión específica del proyecto.",
        ],
        delivery: [
          "Indica las limitaciones de embalaje, cantidad mínima, plazo y destino únicamente cuando estén confirmadas.",
          "Aclara qué instalación, puesta en marcha, documentación o servicio posventa están incluidos.",
        ],
        evidence: [
          "Enlaza fichas técnicas, planos, informes de pruebas, certificados o registros de proyectos aprobados.",
          "No uses ilustraciones, distintivos o afirmaciones sin respaldo como sustitutos de pruebas.",
        ],
      },
    },
    // updatedAt 必须反映内容的最后一次显著变更（改 name/summary/description/
    // 产品详情字段时同步 bump）：sitemap 的 lastmod 直接发布此值，过期会向搜索
    // 引擎谎报新鲜度。上次修正：2026-08-25 产品页新增内嵌询盘表单区块。
    updatedAt: "2026-08-26T00:00:00Z",
  },
] as const satisfies readonly Offering[];

export function getOfferingById(id: string | undefined): Offering | undefined {
  return OFFERINGS.find((offering) => offering.id === id);
}

export function getOfferingForLocale(id: string, locale: Locale): Offering {
  const offering = getOfferingById(id);
  if (!offering) throw new Error(`Offering not found: ${id}`);
  if (locale === LOCALES_CONFIG.defaultLocale) return offering;

  const translation = offering.translations?.[locale];
  if (!translation) {
    throw new Error(`Offering translation not found: ${id}/${locale}`);
  }

  return { ...offering, ...translation };
}

export function getOfferingsForLocale(locale: Locale): readonly Offering[] {
  return OFFERINGS.map((offering) => getOfferingForLocale(offering.id, locale));
}

export function getOfferingPath(id: string): string {
  return `/products/${encodeURIComponent(id)}`;
}
