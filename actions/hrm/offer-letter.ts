"use server";

import { revalidatePath } from "next/cache";
import { Prisma, HrmCandidateStatus } from "@prisma/client";
import { requireFeature } from "@/lib/authz";
import { prismadb } from "@/lib/prisma";
import { getAppName } from "@/lib/app-name";
import { persistAttachmentBuffer } from "@/lib/email/persist-attachment";
import { sendMailViaResend } from "@/lib/email/resend-mail";
import { completeChatWorkflow } from "@/lib/llm";
import { parseQualityMode, type AiQualityMode } from "@/lib/llm/quality-modes";
import { EMPLOYMENT_LABELS, type EmploymentType } from "@/lib/hrm/employment";
import { clampOfferMargins, isOfferDoc } from "@/lib/hrm/offer-doc";
import { sanitizeOfferHtml, starterOfferHtml } from "@/lib/hrm/offer-html";
import { renderOfferPdf } from "@/lib/hrm/offer-pdf";

const MAX_HTML = 80_000;

function pngDataUrl(bytes: Uint8Array) {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function getOfferStudio(candidateId: string) {
  await requireFeature("hrm", "view");
  const [candidate, letterhead] = await Promise.all([
    prismadb.hrmCandidate.findUnique({ where: { id: candidateId } }),
    prismadb.docLetterhead.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);
  if (!candidate) return null;
  const startDate = candidate.startDate ? candidate.startDate.toISOString().slice(0, 10) : null;
  const html =
    candidate.offerHtml?.trim() ||
    starterOfferHtml({
      fullName: candidate.fullName,
      jobTitle: candidate.jobTitle,
      employmentType: candidate.employmentType,
      startDate,
      compensation: candidate.compensation,
    });

  return {
    candidate: {
      id: candidate.id,
      fullName: candidate.fullName,
      email: candidate.email,
      jobTitle: candidate.jobTitle,
      employmentType: candidate.employmentType,
      compensation: candidate.compensation,
      startDate,
      offerSentAt: candidate.offerSentAt ? candidate.offerSentAt.toISOString() : null,
      offerPdfUrl: candidate.offerPdfUrl,
    },
    html,
    margins: clampOfferMargins(candidate.offerMargins),
    letterhead: letterhead
      ? {
          name: letterhead.name,
          accentColor: letterhead.accentColor,
          pageWidth: letterhead.pageWidth,
          pageHeight: letterhead.pageHeight,
          headerHeight: letterhead.headerHeight,
          footerHeight: letterhead.footerHeight,
          headerUrl: pngDataUrl(letterhead.headerPng),
          footerUrl: pngDataUrl(letterhead.footerPng),
        }
      : null,
  };
}

export async function saveOfferDraft(input: {
  candidateId: string;
  html: string;
  doc: unknown;
  margins: unknown;
}): Promise<{ ok: true } | { error: string }> {
  await requireFeature("hrm", "edit");
  const html = sanitizeOfferHtml(input.html || "");
  if (!html) return { error: "Write the offer letter first" };
  if (!isOfferDoc(input.doc)) return { error: "The letter could not be saved" };
  const margins = clampOfferMargins(input.margins);
  const existing = await prismadb.hrmCandidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true },
  });
  if (!existing) return { error: "Candidate not found" };

  await prismadb.hrmCandidate.update({
    where: { id: input.candidateId },
    data: {
      offerHtml: html.slice(0, MAX_HTML),
      offerDoc: input.doc as Prisma.InputJsonValue,
      offerMargins: margins as Prisma.InputJsonValue,
    },
  });
  revalidatePath(`/hrm/${input.candidateId}`);
  revalidatePath(`/hrm/${input.candidateId}/offer`);
  return { ok: true };
}

function readModelHtml(content: string): string {
  const trimmed = content.trim().replace(/^```(?:json|html)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed) as { html?: unknown };
    if (typeof parsed.html === "string") return sanitizeOfferHtml(parsed.html);
  } catch {
    // The model sometimes returns the letter HTML directly.
  }
  return sanitizeOfferHtml(trimmed);
}

export async function generateOfferLetter(input: {
  candidateId: string;
  prompt: string;
  action: "draft" | "improve" | "shorten" | "formal";
  existingHtml?: string;
  qualityMode?: AiQualityMode;
}): Promise<{ ok: true; html: string } | { error: string }> {
  const user = await requireFeature("hrm", "edit");
  const candidate = await prismadb.hrmCandidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate) return { error: "Candidate not found" };

  const employment =
    EMPLOYMENT_LABELS[candidate.employmentType as EmploymentType] ?? candidate.employmentType;
  const facts = [
    `Candidate: ${candidate.fullName}`,
    `Email: ${candidate.email}`,
    candidate.jobTitle ? `Role: ${candidate.jobTitle}` : "",
    `Employment type: ${employment}`,
    candidate.startDate ? `Start date: ${candidate.startDate.toISOString().slice(0, 10)}` : "",
    candidate.compensation ? `Compensation: ${candidate.compensation}` : "",
    candidate.location ? `Location: ${candidate.location}` : "",
    candidate.phone ? `Phone: ${candidate.phone}` : "",
    candidate.summary ? `Background: ${candidate.summary.slice(0, 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const actionLine = {
    draft: "Write the offer letter from the instruction.",
    improve: "Improve the current letter. Keep every fact.",
    shorten: "Make the current letter shorter. Keep the offer terms.",
    formal: "Make the current letter more formal. Keep the offer terms.",
  }[input.action];

  const current = sanitizeOfferHtml(input.existingHtml || candidate.offerHtml || "").slice(0, 12_000);
  const instruction = input.prompt.trim().slice(0, 2_000);

  try {
    const result = await completeChatWorkflow({
      task: "quick-copy",
      userId: user.id,
      mode: parseQualityMode(input.qualityMode ?? "good"),
      temperature: 0.4,
      userBrief: instruction || actionLine,
      messages: [
        {
          role: "system",
          content: [
            "You draft offer letters for a company. The letter is printed between an existing letterhead header and footer.",
            "Do not invent a logo, address, CIN, GSTIN, or letterhead. Do not invent pay, dates, or titles that are not in the facts.",
            "Return only JSON: {\"html\":\"...\"}.",
            "The html may use p, h1, h2, h3, strong, em, u, s, ul, ol, li, and br.",
            "Keep it to a short letter, usually one or two pages.",
          ].join(" "),
        },
        {
          role: "user",
          content: `${actionLine}\n\nFacts:\n${facts}\n\nInstruction:\n${instruction || "Write a clear offer letter."}\n\nCurrent letter HTML:\n${current || "(empty)"}`,
        },
      ],
    });
    const html = readModelHtml(result.content);
    if (!html) return { error: "The assistant returned an empty letter" };
    return { ok: true, html };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The assistant could not write the letter" };
  }
}

async function letterheadAndDoc(candidateId: string) {
  const candidate = await prismadb.hrmCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return { ok: false as const, error: "Candidate not found" };
  if (!isOfferDoc(candidate.offerDoc)) return { ok: false as const, error: "Save the offer letter before sending it" };
  const letterhead = await prismadb.docLetterhead.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!letterhead) return { ok: false as const, error: "Upload the company letterhead in Doc maker first" };
  return { ok: true as const, candidate, letterhead, doc: candidate.offerDoc };
}

export async function sendOfferLetter(candidateId: string): Promise<{ ok: true } | { error: string }> {
  await requireFeature("hrm", "edit");
  const loaded = await letterheadAndDoc(candidateId);
  if (!loaded.ok) return { error: loaded.error };
  const { candidate, letterhead, doc } = loaded;

  const fromAddress = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "";
  if (!fromAddress) return { error: "Set EMAIL_FROM or RESEND_FROM_EMAIL so the offer can be emailed" };

  const pdf = await renderOfferPdf({
    doc,
    margins: clampOfferMargins(candidate.offerMargins),
    pageWidth: letterhead.pageWidth,
    pageHeight: letterhead.pageHeight,
    headerHeight: letterhead.headerHeight,
    footerHeight: letterhead.footerHeight,
    accentColor: letterhead.accentColor,
    headerPng: Buffer.from(letterhead.headerPng),
    footerPng: Buffer.from(letterhead.footerPng),
  });

  const stored = await persistAttachmentBuffer(`offer-${candidate.fullName}.pdf`, "application/pdf", Buffer.from(pdf));
  const appName = getAppName();
  await sendMailViaResend({
    fromEmail: fromAddress,
    fromName: appName,
    to: [candidate.email],
    subject: `Your offer from ${appName}${candidate.jobTitle ? ` — ${candidate.jobTitle}` : ""}`,
    text: `Hello ${candidate.fullName},\n\nPlease find your offer letter attached.\n`,
    html: `<p>Hello ${candidate.fullName},</p><p>Please find your offer letter attached.</p>`,
    attachments: [{ filename: "offer-letter.pdf", content: Buffer.from(pdf), contentType: "application/pdf" }],
  });

  await prismadb.hrmCandidate.update({
    where: { id: candidate.id },
    data: {
      status: HrmCandidateStatus.hired,
      offerPdfUrl: stored.url,
      offerSentAt: new Date(),
    },
  });
  revalidatePath(`/hrm/${candidate.id}`);
  revalidatePath(`/hrm/${candidate.id}/offer`);
  revalidatePath("/hrm");
  return { ok: true };
}
