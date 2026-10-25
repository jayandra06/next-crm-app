import { VENSAI_BRAND, getBrandLogoUrl } from "@/lib/brand/vensai";

export const SIGNATURE_MARKER = 'data-crm-signature="1"';
export const SIGNATURE_CID = "crm-signature-image";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailSignatureInput = {
  senderName?: string | null;
  customText?: string | null;
  imageUrl?: string | null;
  /** Override the img src, for example a cid: reference on the sent message. */
  imageSrc?: string | null;
};

export function resolveSignatureImageUrl(customUrl?: string | null) {
  const custom = customUrl?.trim();
  return custom || getBrandLogoUrl();
}

export function buildEmailSignature(input: EmailSignatureInput): { html: string; plain: string; imageUrl: string } {
  const senderName = input.senderName?.trim() || "VenSai Labs Team";
  const imageUrl = resolveSignatureImageUrl(input.imageUrl);
  const src = input.imageSrc?.trim() || imageUrl;
  const { companyName, tagline, website, colors, email } = VENSAI_BRAND;
  const siteLabel = website.replace(/^https?:\/\//, "");
  const customLines = input.customText
    ?.split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const textLines = customLines?.length
    ? customLines
    : [senderName, companyName, tagline, siteLabel];

  const htmlLines = textLines
    .map((line, index) => {
      const safe = escapeHtml(line);
      if (index === 0) {
        return `<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${colors.navy};">${safe}</p>`;
      }
      if (!customLines?.length && index === textLines.length - 1) {
        return `<p style="margin:8px 0 0;font-size:12px;"><a href="${website}" style="color:${colors.primaryDark};text-decoration:none;">${safe}</a></p>`;
      }
      return `<p style="margin:0 0 2px;font-size:12px;color:${index === 1 ? colors.text : colors.muted};">${safe}</p>`;
    })
    .join("");

  const html = `<table role="presentation" ${SIGNATURE_MARKER} cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;font-family:${email.fontFamily};">
<tr>
<td style="padding:16px 14px 0 0;border-top:1px solid ${colors.border};vertical-align:top;">
<img src="${escapeHtml(src)}" alt="${escapeHtml(companyName)}" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:8px;border:0;" />
</td>
<td style="padding-top:16px;border-top:1px solid ${colors.border};vertical-align:top;">
${htmlLines}
</td>
</tr>
</table>`;

  return {
    html,
    plain: textLines.join("\n"),
    imageUrl,
  };
}
