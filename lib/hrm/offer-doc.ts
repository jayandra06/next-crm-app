export type OfferMargins = { top: number; right: number; bottom: number; left: number };

export const DEFAULT_OFFER_MARGINS: OfferMargins = { top: 12, right: 40, bottom: 12, left: 40 };

export type OfferMark = { type: string; attrs?: Record<string, unknown> };

export type OfferNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: OfferMark[];
  content?: OfferNode[];
};

const MIN_MARGIN = 8;
const MAX_MARGIN = 96;

function num(value: unknown, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(n)));
}

export function clampOfferMargins(value: unknown): OfferMargins {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    top: num(row.top, DEFAULT_OFFER_MARGINS.top),
    right: num(row.right, DEFAULT_OFFER_MARGINS.right),
    bottom: num(row.bottom, DEFAULT_OFFER_MARGINS.bottom),
    left: num(row.left, DEFAULT_OFFER_MARGINS.left),
  };
}

export function pdfFontName(family: string | null | undefined, bold: boolean, italic: boolean): string {
  const times = family === "times" || family === "Times New Roman" || family === "serif";
  if (times) {
    if (bold && italic) return "Times-BoldItalic";
    if (bold) return "Times-Bold";
    if (italic) return "Times-Italic";
    return "Times-Roman";
  }
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

export function isOfferDoc(value: unknown): value is OfferNode {
  return Boolean(value && typeof value === "object" && (value as OfferNode).type === "doc");
}
