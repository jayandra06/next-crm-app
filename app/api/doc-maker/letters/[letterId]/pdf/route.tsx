import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prismadb } from "@/lib/prisma";
import { AuthorizationError, isManagerOrAdmin, requireFeature } from "@/lib/authz";
import { LetterPdf } from "@/lib/doc-maker/render-letter";

export async function GET(_req: Request, ctx: { params: Promise<{ letterId: string }> }) {
  try {
    const user = await requireFeature("doc_maker", "view");
    const { letterId } = await ctx.params;
    const letter = await prismadb.docLetter.findUnique({
      where: { id: letterId },
      select: { id: true, title: true, body: true, createdById: true, letterhead: true },
    });
    if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (letter.createdById !== user.id && !isManagerOrAdmin(user)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pdf = await renderToBuffer(
      <LetterPdf
        letter={{
          title: letter.title,
          body: letter.body,
          pageWidth: letter.letterhead.pageWidth,
          pageHeight: letter.letterhead.pageHeight,
          headerHeight: letter.letterhead.headerHeight,
          footerHeight: letter.letterhead.footerHeight,
          sideMargin: letter.letterhead.sideMargin,
          accentColor: letter.letterhead.accentColor,
          headerPng: Buffer.from(letter.letterhead.headerPng),
          footerPng: Buffer.from(letter.letterhead.footerPng),
        }}
      />
    );

    const filename = `${letter.title.replace(/[^\w.-]+/g, "_").slice(0, 80) || "letter"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[doc-maker pdf]", error);
    return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
  }
}
