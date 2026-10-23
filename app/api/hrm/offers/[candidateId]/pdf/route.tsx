import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { AuthorizationError, requireFeature } from "@/lib/authz";
import { clampOfferMargins, isOfferDoc } from "@/lib/hrm/offer-doc";
import { renderOfferPdf } from "@/lib/hrm/offer-pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ candidateId: string }> }) {
  try {
    await requireFeature("hrm", "view");
    const { candidateId } = await ctx.params;
    const candidate = await prismadb.hrmCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate || !isOfferDoc(candidate.offerDoc)) {
      return NextResponse.json({ error: "Save the offer letter first" }, { status: 404 });
    }
    const letterhead = await prismadb.docLetterhead.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!letterhead) return NextResponse.json({ error: "Upload a letterhead first" }, { status: 404 });

    const pdf = await renderOfferPdf({
      doc: candidate.offerDoc,
      margins: clampOfferMargins(candidate.offerMargins),
      pageWidth: letterhead.pageWidth,
      pageHeight: letterhead.pageHeight,
      headerHeight: letterhead.headerHeight,
      footerHeight: letterhead.footerHeight,
      accentColor: letterhead.accentColor,
      headerPng: Buffer.from(letterhead.headerPng),
      footerPng: Buffer.from(letterhead.footerPng),
    });

    const filename = `offer-${candidate.fullName.replace(/[^\w.-]+/g, "_").slice(0, 60) || "letter"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[offer pdf]", error);
    return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
  }
}
