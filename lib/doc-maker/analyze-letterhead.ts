import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import {
  chooseBands,
  contactLinesFromText,
  dividerBandInHeader,
  extendHeaderPastDivider,
  footerStartAtSolidBar,
  headerEndAfterDivider,
  sideMarginRatio,
} from "@/lib/doc-maker/bands";

export type AnalyzedLetterhead = {
  accentColor: string;
  contactLines: string[];
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  footerHeight: number;
  sideMargin: number;
  headerPng: Buffer;
  footerPng: Buffer;
};

function isLogoRed(r: number, g: number, b: number): boolean {
  return r > 170 && g < 150 && b < 140 && r - Math.max(g, b) > 50;
}

/** The flat red block pdf.js paints in place of the real logo image. */
function findLogoSquare(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  const limitY = Math.round(height * 0.3);
  const runs: { y: number; start: number; end: number }[] = [];
  for (let y = 0; y < limitY; y += 1) {
    let start = -1;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const red = isLogoRed(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      if (red && start < 0) start = x;
      if ((!red || x === width - 1) && start >= 0) {
        const end = red && x === width - 1 ? x + 1 : x;
        const len = end - start;
        if (len > width * 0.05 && len < width * 0.22) runs.push({ y, start, end });
        start = -1;
      }
    }
  }
  if (runs.length < 10) return null;
  const starts = runs.map((run) => run.start).sort((a, b) => a - b);
  const median = starts[Math.floor(starts.length / 2)] ?? 0;
  const cluster = runs.filter((run) => Math.abs(run.start - median) < 14);
  if (cluster.length < 10) return null;
  const x = Math.min(...cluster.map((run) => run.start));
  const right = Math.max(...cluster.map((run) => run.end));
  const y = Math.min(...cluster.map((run) => run.y));
  const bottom = Math.max(...cluster.map((run) => run.y));
  const w = right - x;
  const h = bottom - y + 1;
  if (w < 24 || h < w * 0.7) return null;
  return { x, y, w, h: Math.max(h, Math.round(w * 0.96)) };
}

async function paintEmbeddedLogo(
  parser: { getImage: (params: { partial: number[]; imageBuffer: boolean; imageDataUrl: boolean }) => Promise<{ pages: { images: { data: Uint8Array; width: number; height: number }[] }[] }> },
  ctx: SKRSContext2D,
  width: number,
  height: number
) {
  try {
    const images = await parser.getImage({ partial: [1], imageBuffer: true, imageDataUrl: false });
    const logo = (images.pages[0]?.images ?? [])
      .filter((img) => img.data?.byteLength && img.width >= 40 && Math.abs(img.width - img.height) / img.width < 0.25)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!logo) return;
    const box = findLogoSquare(ctx.getImageData(0, 0, width, height).data, width, height);
    if (!box) return;
    const logoImage = await loadImage(Buffer.from(logo.data));
    ctx.drawImage(logoImage, box.x, box.y, box.w, box.h);
  } catch {
    // The coloured block from the page render remains.
  }
}

function hex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function accentFromHeader(data: Uint8ClampedArray, width: number, headerEnd: number): string {
  const buckets = new Map<string, number>();
  const step = 4;
  for (let y = 0; y < headerEnd; y += 2) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      const a = data[i + 3] ?? 255;
      if (a < 40) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 242 && min > 230) continue;
      if (max - min < 18 && max < 80) continue;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  let best = "";
  let count = 0;
  for (const [key, n] of Array.from(buckets.entries())) {
    if (n > count) {
      best = key;
      count = n;
    }
  }
  if (!best || count < 8) return "#1e3a5f";
  const [r, g, b] = best.split("-").map((part) => Number(part) * 17);
  return `#${hex(r ?? 30)}${hex(g ?? 58)}${hex(b ?? 95)}`;
}

export async function analyzeLetterhead(pdf: Buffer): Promise<AnalyzedLetterhead> {
  if (pdf.length < 5 || pdf.subarray(0, 4).toString() !== "%PDF") {
    throw new Error("Upload a PDF letterhead");
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdf });
  try {
    const shot = await parser.getScreenshot({
      partial: [1],
      desiredWidth: 1000,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const text = await parser.getText({ partial: [1], pageJoiner: "" });
    const page = shot.pages[0];
    if (!page?.data?.byteLength) throw new Error("Could not read the first page of this PDF");

    const image = await loadImage(Buffer.from(page.data));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read the letterhead image");
    ctx.drawImage(image, 0, 0);
    await paintEmbeddedLogo(parser, ctx, image.width, image.height);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    const rowHasInk: boolean[] = [];
    const rowCoverage: number[] = [];
    const colHasInk = Array.from({ length: image.width }, () => false);
    for (let y = 0; y < image.height; y += 1) {
      let ink = 0;
      let samples = 0;
      for (let x = 0; x < image.width; x += 2) {
        samples += 1;
        const i = (y * image.width + x) * 4;
        const r = pixels[i] ?? 255;
        const g = pixels[i + 1] ?? 255;
        const b = pixels[i + 2] ?? 255;
        const a = pixels[i + 3] ?? 255;
        if (a > 20 && (r < 248 || g < 248 || b < 248)) {
          ink += 1;
          colHasInk[x] = true;
        }
      }
      rowHasInk.push(ink > 0);
      rowCoverage.push(samples > 0 ? ink / samples : 0);
    }

    const bands = chooseBands(rowHasInk);
    const ruledHeader = headerEndAfterDivider(rowCoverage);
    if (ruledHeader != null) bands.headerEnd = ruledHeader;
    else bands.headerEnd = extendHeaderPastDivider(rowCoverage, bands.headerEnd);
    const solidFooter = footerStartAtSolidBar(rowCoverage);
    if (solidFooter != null && solidFooter > bands.headerEnd + 40) bands.footerStart = solidFooter;
    const scale = page.scale || image.width / 595;
    const pageWidth = image.width / scale;
    const pageHeight = image.height / scale;
    const marginRatio = sideMarginRatio(colHasInk);

    const crop = (top: number, height: number): Buffer => {
      const slice = createCanvas(image.width, height);
      slice.getContext("2d").drawImage(canvas, 0, top, image.width, height, 0, 0, image.width, height);
      return slice.toBuffer("image/png");
    };

    const headerPx = Math.max(1, bands.headerEnd);
    const footerPx = Math.max(1, image.height - bands.footerStart);
    const divider = dividerBandInHeader(rowCoverage, headerPx);
    let footerPng = crop(bands.footerStart, footerPx);
    let footerHeightPx = footerPx;
    if (divider) {
      const ruleHeight = divider.bottom - divider.top + 1;
      const gap = Math.max(4, Math.round(ruleHeight * 0.8));
      const rule = crop(divider.top, ruleHeight);
      const ruleImage = await loadImage(rule);
      const footerImage = await loadImage(footerPng);
      const combined = createCanvas(image.width, ruleImage.height + gap + footerImage.height);
      const combinedCtx = combined.getContext("2d");
      combinedCtx.fillStyle = "#ffffff";
      combinedCtx.fillRect(0, 0, combined.width, combined.height);
      combinedCtx.drawImage(ruleImage, 0, 0);
      combinedCtx.drawImage(footerImage, 0, ruleImage.height + gap);
      footerPng = combined.toBuffer("image/png");
      footerHeightPx = combined.height;
    }
    return {
      accentColor: accentFromHeader(pixels, image.width, headerPx),
      contactLines: contactLinesFromText(text.text ?? ""),
      pageWidth,
      pageHeight,
      headerHeight: headerPx / scale,
      footerHeight: footerHeightPx / scale,
      sideMargin: pageWidth * marginRatio,
      headerPng: crop(0, headerPx),
      footerPng,
    };
  } finally {
    await parser.destroy?.();
  }
}
