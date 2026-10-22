"use server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { dmRoomKey, parseRoomKey } from "@/lib/chat/room-keys";
import { stripHtmlToPlain } from "@/lib/email/compose-helpers";
import {
  type ChatAttachmentItem,
  type ChatAttachmentDTO,
  parseAttachments,
} from "@/lib/chat/attachments";

export type { ChatAttachmentItem, ChatAttachmentDTO };

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return (session.user.id as string).trim();
}

async function assertRoomAccess(roomKey: string, userId: string): Promise<void> {
  if (!roomKey) return;
  const cleanRoom = roomKey.trim();
  const cleanUser = userId.trim().toLowerCase();

  if (cleanRoom.startsWith("dm:")) {
    const parts = cleanRoom.split(":");
    if (parts.length !== 3) {
      console.warn(`[assertRoomAccess] Invalid DM room key: ${roomKey}`);
      throw new Error("Forbidden");
    }
    const userA = parts[1]?.trim().toLowerCase();
    const userB = parts[2]?.trim().toLowerCase();
    if (cleanUser !== userA && cleanUser !== userB) {
      console.warn(`[assertRoomAccess] User ${cleanUser} is not part of DM ${roomKey}`);
      throw new Error("Forbidden");
    }
    return;
  }

  if (cleanRoom.startsWith("conf:")) {
    const id = cleanRoom.slice(5).trim();
    const entry = await prismadb.teamScheduleEntry.findUnique({
      where: { id },
      select: { organizerId: true, attendeeIds: true },
    });
    if (!entry) throw new Error("Forbidden");
    const attendees = Array.isArray(entry.attendeeIds)
      ? entry.attendeeIds
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim().toLowerCase())
      : [];
    const organizer = entry.organizerId?.trim().toLowerCase();
    if (organizer !== cleanUser && !attendees.includes(cleanUser)) {
      throw new Error("Forbidden");
    }
  }
}

export type ChatMessageDTO = {
  id: string;
  roomKey: string;
  body: string;
  htmlBody: string | null;
  attachment: ChatAttachmentItem | null;
  attachments: ChatAttachmentItem[];
  createdAt: string;
  user: { id: string; name: string; email: string };
};

function mapRows(
  rows: {
    id: string;
    roomKey: string;
    userId: string;
    body: string;
    htmlBody: string | null;
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentMime: string | null;
    createdAt: Date;
    user?: { id: string; name: string | null; email: string } | null;
  }[]
): ChatMessageDTO[] {
  return rows.map((r) => {
    const parsedAttachments = parseAttachments(
      r.attachmentUrl,
      r.attachmentName,
      r.attachmentMime
    );
    return {
      id: r.id,
      roomKey: r.roomKey,
      body: r.body,
      htmlBody: r.htmlBody,
      attachment: parsedAttachments[0] ?? null,
      attachments: parsedAttachments,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user?.id || r.userId || "unknown",
        name: r.user?.name?.trim() || r.user?.email || "Team Member",
        email: r.user?.email || "",
      },
    };
  });
}

export async function getChatMessages(roomKeyRaw: string, afterIso?: string): Promise<ChatMessageDTO[]> {
  try {
    const userId = await requireUserId();
    const roomKey = parseRoomKey(roomKeyRaw);
    await assertRoomAccess(roomKey, userId);

    const afterDate = afterIso ? new Date(afterIso) : null;
    const validAfter = afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : null;

    if (validAfter) {
      const rows = await prismadb.teamChatMessage.findMany({
        where: { roomKey, createdAt: { gt: validAfter } },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return mapRows(rows);
    }

    const rows = await prismadb.teamChatMessage.findMany({
      where: { roomKey },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return mapRows(rows.reverse());
  } catch (error) {
    console.error("[getChatMessages] Error fetching messages:", error);
    return [];
  }
}

export async function sendChatMessage(
  roomKeyRaw: string,
  htmlBody: string,
  attachmentsInput?: ChatAttachmentItem | ChatAttachmentItem[] | null
): Promise<ChatMessageDTO> {
  const userId = await requireUserId();
  const roomKey = parseRoomKey(roomKeyRaw);
  await assertRoomAccess(roomKey, userId);

  const attachments: ChatAttachmentItem[] = Array.isArray(attachmentsInput)
    ? attachmentsInput.filter((a) => Boolean(a?.url))
    : attachmentsInput?.url
      ? [attachmentsInput]
      : [];

  const html = (htmlBody ?? "").trim();
  const hasText = html && html !== "<p></p>";
  const hasFiles = attachments.length > 0;

  if (!hasText && !hasFiles) throw new Error("Message is empty");

  const body = hasText
    ? stripHtmlToPlain(html)
    : attachments.length === 1
      ? attachments[0].name
      : `${attachments.length} attachments`;

  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentMime: string | null = null;

  if (attachments.length === 1) {
    attachmentUrl = attachments[0].url;
    attachmentName = attachments[0].name;
    attachmentMime = attachments[0].mime;
  } else if (attachments.length > 1) {
    attachmentUrl = JSON.stringify(attachments);
    attachmentName = `${attachments.length} attachments`;
    attachmentMime = "application/json;kind=attachments";
  }

  const msg = await prismadb.teamChatMessage.create({
    data: {
      roomKey,
      userId,
      body,
      htmlBody: hasText ? html : null,
      attachmentUrl,
      attachmentName,
      attachmentMime,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const parsedAttachments = parseAttachments(
    msg.attachmentUrl,
    msg.attachmentName,
    msg.attachmentMime
  );

  return {
    id: msg.id,
    roomKey: msg.roomKey,
    body: msg.body,
    htmlBody: msg.htmlBody,
    attachment: parsedAttachments[0] ?? null,
    attachments: parsedAttachments,
    createdAt: msg.createdAt.toISOString(),
    user: {
      id: msg.user?.id || userId,
      name: msg.user?.name?.trim() || msg.user?.email || "You",
      email: msg.user?.email || "",
    },
  } satisfies ChatMessageDTO;
}

export async function getDmRoomKey(otherUserId: string): Promise<string> {
  const userId = await requireUserId();
  if (otherUserId === userId) throw new Error("Invalid user");
  return dmRoomKey(userId, otherUserId);
}
