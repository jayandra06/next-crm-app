import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfferStudio } from "@/actions/hrm/offer-letter";
import { OfferStudio } from "./OfferStudio";

export default async function OfferLetterPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const studio = await getOfferStudio(candidateId);
  if (!studio) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Link href={`/hrm/${studio.candidate.id}`} className="text-sm text-muted-foreground hover:underline">
          Back to {studio.candidate.fullName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Offer letter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {studio.candidate.email}
          {studio.candidate.jobTitle ? ` · ${studio.candidate.jobTitle}` : ""}
        </p>
      </div>
      <OfferStudio
        candidateId={studio.candidate.id}
        initialHtml={studio.html}
        initialMargins={studio.margins}
        letterhead={studio.letterhead}
        offerSentAt={studio.candidate.offerSentAt}
      />
    </main>
  );
}
