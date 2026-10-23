const MAX_HTML = 80_000;

/** Keep pasted or model HTML inside the small set of marks the offer editor understands. */
export function sanitizeOfferHtml(value: string): string {
  let html = value.trim().replace(/^\uFEFF/, "");
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```$/i, "").trim();
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  if (!/<(p|h1|h2|h3|ul|ol|li|div|br)\b/i.test(html)) {
    const escaped = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = escaped
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }
  return html.slice(0, MAX_HTML);
}

export function starterOfferHtml(candidate: {
  fullName: string;
  jobTitle: string | null;
  employmentType: string;
  startDate: string | null;
  compensation: string | null;
}): string {
  const role = candidate.jobTitle?.trim() || "the role we discussed";
  const when = candidate.startDate ? ` starting ${candidate.startDate}` : "";
  const pay = candidate.compensation?.trim() ? ` Compensation: ${candidate.compensation.trim()}.` : "";
  return [
    "<h1>Offer letter</h1>",
    `<p>Dear ${candidate.fullName},</p>`,
    `<p>We are pleased to offer you ${role} (${candidate.employmentType.replace(/_/g, " ")})${when}.${pay}</p>`,
    "<p>Please reply to confirm that you accept this offer.</p>",
    "<p>Warm regards,</p>",
  ].join("");
}
