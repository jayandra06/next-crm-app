"use server";

import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { AuthorizationError, isManagerOrAdmin, requireFeature } from "@/lib/authz";
import { analyzeLetterhead } from "@/lib/doc-maker/analyze-letterhead";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

function fail(error: unknown): { error: string } {
  if (error instanceof AuthorizationError) return { error: "You do not have access to Doc maker" };
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function uploadLetterhead(formData: FormData): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireFeature("doc_maker", "create");
    if (!isManagerOrAdmin(user)) return { error: "Only an admin or manager can set the letterhead" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "Choose a PDF letterhead" };
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) return { error: "The PDF must be under 12 MB" };
    const pdf = Buffer.from(await file.arrayBuffer());
    const analyzed = await analyzeLetterhead(pdf);
    const name = file.name.replace(/\.pdf$/i, "").trim() || "Letterhead";

    const current = await prismadb.docLetterhead.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    const data = {
      name,
      accentColor: analyzed.accentColor,
      contactLines: analyzed.contactLines,
      pageWidth: analyzed.pageWidth,
      pageHeight: analyzed.pageHeight,
      headerHeight: analyzed.headerHeight,
      footerHeight: analyzed.footerHeight,
      sideMargin: analyzed.sideMargin,
      headerPng: Uint8Array.from(analyzed.headerPng),
      footerPng: Uint8Array.from(analyzed.footerPng),
      createdById: user.id,
    };
    if (current) {
      await prismadb.docLetterhead.update({ where: { id: current.id }, data });
    } else {
      await prismadb.docLetterhead.create({ data });
    }
    revalidatePath("/[locale]/(routes)/doc-maker", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveDocLetter(input: {
  id?: string;
  title: string;
  body: string;
}): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requireFeature("doc_maker", "create");
    const title = input.title.trim().slice(0, 180) || "Untitled letter";
    const body = input.body.slice(0, 20_000);
    const letterhead = await prismadb.docLetterhead.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!letterhead) return { error: "Upload a letterhead PDF first" };

    if (input.id) {
      const existing = await prismadb.docLetter.findUnique({
        where: { id: input.id },
        select: { id: true, createdById: true },
      });
      if (!existing) return { error: "Letter not found" };
      if (existing.createdById !== user.id && !isManagerOrAdmin(user)) {
        return { error: "You can only edit your own letters" };
      }
      await prismadb.docLetter.update({
        where: { id: existing.id },
        data: { title, body, letterheadId: letterhead.id },
      });
      revalidatePath("/[locale]/(routes)/doc-maker", "page");
      return { id: existing.id };
    }

    const created = await prismadb.docLetter.create({
      data: { title, body, letterheadId: letterhead.id, createdById: user.id },
      select: { id: true },
    });
    revalidatePath("/[locale]/(routes)/doc-maker", "page");
    return { id: created.id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDocLetter(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireFeature("doc_maker", "delete");
    const existing = await prismadb.docLetter.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) return { error: "Letter not found" };
    if (existing.createdById !== user.id && !isManagerOrAdmin(user)) {
      return { error: "You can only delete your own letters" };
    }
    await prismadb.docLetter.delete({ where: { id: existing.id } });
    revalidatePath("/[locale]/(routes)/doc-maker", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
