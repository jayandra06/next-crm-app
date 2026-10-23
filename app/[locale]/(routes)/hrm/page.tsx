import Link from "next/link";
import { listCandidates } from "@/actions/hrm/candidates";
import { EMPLOYMENT_LABELS, STATUS_LABELS, type CandidateStatus, type EmploymentType } from "@/lib/hrm/employment";
import { NewCandidateForm } from "./NewCandidateForm";

export default async function HrmPage() {
  const candidates = await listCandidates();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hiring</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Add a candidate, upload their PDF resume, and review the details pulled from it. Draft the offer on the
          company letterhead, then email it as a PDF.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Letterhead</h2>
        <p className="text-sm text-muted-foreground">
          Upload the offer-letter PDF in Doc maker. Hiring uses that header and footer, and the letter is written in
          the space between them.
        </p>
        <Link href="/doc-maker" className="text-sm font-medium underline">
          Open Doc maker
        </Link>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">New candidate</h2>
        <NewCandidateForm />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pipeline</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <Link href={`/hrm/${candidate.id}`} className="font-medium hover:underline">
                    {candidate.fullName}
                  </Link>
                  <p className="text-muted-foreground">
                    {candidate.email} · {EMPLOYMENT_LABELS[candidate.employmentType as EmploymentType]}
                    {candidate.jobTitle ? ` · ${candidate.jobTitle}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {STATUS_LABELS[candidate.status as CandidateStatus]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
