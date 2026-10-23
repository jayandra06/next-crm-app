/** Rows or columns that contain non-white ink, top to bottom or left to right. */
export function chooseBands(rowHasInk: boolean[]): { headerEnd: number; footerStart: number } {
  const height = rowHasInk.length;
  const fallback = () => ({
    headerEnd: Math.max(1, Math.round(height * 0.22)),
    footerStart: Math.max(2, Math.round(height * 0.86)),
  });
  if (height < 40) return fallback();

  const minGap = Math.max(8, Math.round(height * 0.04));
  const gaps: { start: number; end: number }[] = [];
  let index = 0;
  while (index < height) {
    if (rowHasInk[index]) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < height && !rowHasInk[index]) index += 1;
    if (index - start >= minGap) gaps.push({ start, end: index });
  }

  const headerGap = gaps.find((gap) => gap.start > height * 0.06 && gap.start < height * 0.48);
  const footerGap = [...gaps]
    .reverse()
    .find((gap) => gap.start > height * 0.5 && gap.end < height * 0.97 && gap.end > height * 0.55);

  let headerEnd = headerGap ? Math.min(headerGap.start + 6, headerGap.end) : Math.round(height * 0.22);
  let footerStart = footerGap ? Math.max(footerGap.end - 6, footerGap.start) : Math.round(height * 0.86);

  if (footerStart - headerEnd < height * 0.25) return fallback();
  headerEnd = Math.max(1, Math.min(headerEnd, height - 2));
  footerStart = Math.max(headerEnd + 1, Math.min(footerStart, height - 1));
  return { headerEnd, footerStart };
}

const DIVIDER_COVERAGE = 0.45;

/**
 * Header stops just after the full-width rule under the logo.
 * Body text such as "OFFER LETTER" stays out of the header.
 */
export function headerEndAfterDivider(rowCoverage: number[]): number | null {
  const height = rowCoverage.length;
  const limit = Math.round(height * 0.42);
  let y = 0;
  while (y < limit) {
    if ((rowCoverage[y] ?? 0) < 0.7) {
      y += 1;
      continue;
    }
    const top = y;
    while (y < limit && (rowCoverage[y] ?? 0) >= 0.7) y += 1;
    const bottom = y - 1;
    const band = bottom - top + 1;
    if (band >= 2 && band <= Math.max(14, Math.round(height * 0.02)) && top > height * 0.05) {
      return Math.min(height - 2, bottom + 4);
    }
  }
  return null;
}

/** Footer starts at the solid colour bar, not at the last paragraph of the letter. */
export function footerStartAtSolidBar(rowCoverage: number[]): number | null {
  const height = rowCoverage.length;
  const floor = Math.round(height * 0.55);
  let y = height - 1;
  while (y > floor && (rowCoverage[y] ?? 0) < 0.9) y -= 1;
  if ((rowCoverage[y] ?? 0) < 0.9) return null;
  while (y > floor && (rowCoverage[y - 1] ?? 0) >= 0.9) y -= 1;
  const top = y;
  const bottom = (() => {
    let end = top;
    while (end < height - 1 && (rowCoverage[end + 1] ?? 0) >= 0.9) end += 1;
    return end;
  })();
  if (bottom - top + 1 < Math.round(height * 0.025)) return null;
  return Math.max(0, top - 2);
}

/** Pull the header down through the rule that sits just under the logo block. */
export function extendHeaderPastDivider(rowCoverage: number[], headerEnd: number): number {
  const height = rowCoverage.length;
  if (headerEnd < 8 || headerEnd >= height - 2) return headerEnd;
  const lookUntil = Math.min(height - 1, headerEnd + Math.max(8, Math.round(height * 0.08)));
  let y = headerEnd;
  while (y < lookUntil && (rowCoverage[y] ?? 0) < DIVIDER_COVERAGE) y += 1;
  if ((rowCoverage[y] ?? 0) < DIVIDER_COVERAGE) return headerEnd;
  const top = y;
  while (y < lookUntil && (rowCoverage[y] ?? 0) >= DIVIDER_COVERAGE) y += 1;
  const bottom = y - 1;
  const band = bottom - top + 1;
  if (band < 1 || band > Math.max(6, Math.round(height * 0.04))) return headerEnd;
  return Math.min(height - 2, bottom + 3);
}

/** The full-width rule at the bottom of the header, so the footer can use the same line. */
export function dividerBandInHeader(
  rowCoverage: number[],
  headerEnd: number
): { top: number; bottom: number } | null {
  const end = Math.min(headerEnd, rowCoverage.length);
  if (end < 8) return null;
  let y = end - 1;
  while (y > 0 && (rowCoverage[y] ?? 0) < DIVIDER_COVERAGE) y -= 1;
  if ((rowCoverage[y] ?? 0) < DIVIDER_COVERAGE) return null;
  const bottom = y;
  while (y > 0 && (rowCoverage[y - 1] ?? 0) >= DIVIDER_COVERAGE) y -= 1;
  const top = y;
  const band = bottom - top + 1;
  if (band < 1 || band > Math.max(6, Math.round(end * 0.12))) return null;
  if (top < end * 0.28) return null;
  return { top, bottom };
}

/** Left and right quiet margin, as a fraction of the page width. */
export function sideMarginRatio(colHasInk: boolean[]): number {
  const first = colHasInk.indexOf(true);
  const last = colHasInk.lastIndexOf(true);
  if (first < 0 || last < 0) return 0.08;
  const quiet = Math.min(first, colHasInk.length - 1 - last);
  return Math.min(0.18, Math.max(0.05, quiet / colHasInk.length));
}

function isLetterheadLine(line: string): boolean {
  if (line.length < 2 || line.length > 90) return false;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/.test(line)) return false;
  const looksLikeContact = /@|www\.|https?:|\+?\d[\d\s().-]{6,}/i.test(line);
  if (!looksLikeContact && line.length > 42) return false;
  if (/^(offer letter|date\b|letter no\b|to,|subject\b|dear\b|ms\.|mr\.|mrs\.)/i.test(line)) return false;
  if (/^\d+\.\s/.test(line)) return false;
  if (/\.$/.test(line) && !looksLikeContact) return false;
  if (/:/.test(line) && !/corporate office|registered office|registred office|cin|gstin|phone|e-?mail|www/i.test(line)) return false;
  return true;
}

/** Short lines from the top and bottom of the PDF text — the contact block. */
export function contactLinesFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(isLetterheadLine);
  const head = lines.slice(0, 8);
  const foot = lines.slice(-6).filter((line) => !head.includes(line));
  return [...head, ...foot].slice(0, 12);
}
