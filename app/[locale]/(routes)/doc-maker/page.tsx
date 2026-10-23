import { prismadb } from "@/lib/prisma";
import { can, isManagerOrAdmin, requireAuthenticated } from "@/lib/authz";
import { DocMaker } from "./DocMaker";

function pngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

export default async function DocMakerPage() {
  const user = await requireAuthenticated();
  const [canCreate, letterhead, letters] = await Promise.all([
    can(user, "doc_maker", "create"),
    prismadb.docLetterhead.findFirst({ orderBy: { updatedAt: "desc" } }),
    prismadb.docLetter.findMany({
      where: isManagerOrAdmin(user) ? {} : { createdById: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, body: true, updatedAt: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Doc maker</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Upload a letterhead PDF. The header and footer — logo, contact details, colour, and spacing — stay put.
          Write the letter in the open space between them.
        </p>
      </div>
      <DocMaker
        canUpload={isManagerOrAdmin(user)}
        canCreate={canCreate}
        letterhead={
          letterhead
            ? {
                name: letterhead.name,
                accentColor: letterhead.accentColor,
                contactLines: Array.isArray(letterhead.contactLines)
                  ? letterhead.contactLines.filter((line): line is string => typeof line === "string")
                  : [],
                headerUrl: pngDataUrl(letterhead.headerPng),
                footerUrl: pngDataUrl(letterhead.footerPng),
                sideMarginRatio:
                  letterhead.pageWidth > 0
                    ? Math.min(0.18, Math.max(0.05, letterhead.sideMargin / letterhead.pageWidth))
                    : 0.08,
              }
            : null
        }
        letters={letters.map((letter) => ({
          id: letter.id,
          title: letter.title,
          body: letter.body,
          updatedAt: letter.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
