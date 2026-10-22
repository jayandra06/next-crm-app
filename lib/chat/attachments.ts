/** Attachment models and parsing utilities for Team Chat */

export type ChatAttachmentItem = {
  url: string;
  name: string;
  mime: string;
  size?: number;
};

export type ChatAttachmentDTO = ChatAttachmentItem | null;

export function parseAttachments(
  url: string | null,
  name: string | null,
  mime: string | null
): ChatAttachmentItem[] {
  if (!url) return [];
  const trimmed = url.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is ChatAttachmentItem =>
            Boolean(item && typeof item.url === "string" && item.url.trim().length > 0)
        );
      }
    } catch {
      // fallback to single attachment below
    }
  }
  return [
    {
      url: trimmed,
      name: name?.trim() || "Attachment",
      mime: mime?.trim() || "application/octet-stream",
    },
  ];
}
