"use server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { GENERAL_CHAT_ROOM } from "@/lib/chat/room-keys";

export type ChatInboxPreview = {
  roomKey: string;
  lastBody: string | null;
  lastAt: string | null;
  lastUserId: string | null;
  lastUserName: string | null;
  unread: number;
};

function allowedRoom(userId: string, roomKey: string, peerIds: Set<string>): boolean {
  if (roomKey === GENERAL_CHAT_ROOM) return true;
  if (!roomKey.startsWith("dm:")) return false;
  const parts = roomKey.split(":");
  if (parts.length !== 3) return false;
  const me = userId.trim().toLowerCase();
  if (parts[1] !== me && parts[2] !== me) return false;
  const peer = parts[1] === me ? parts[2] : parts[1];
  return peerIds.has(peer);
}

export async function getChatInboxPreviews(roomKeys: string[]): Promise<ChatInboxPreview[]> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return [];
    const userId = (session.user.id as string).trim();

    const peers = await prismadb.users.findMany({
      where: { userStatus: "ACTIVE" },
      select: { id: true },
      take: 100,
    });
    const peerIds = new Set(
      peers.map((p) => p.id.trim().toLowerCase()).filter((id) => id !== userId.toLowerCase())
    );
    const keys = Array.from(
      new Set(
        roomKeys
          .map((k) => k.trim())
          .filter((k) => allowedRoom(userId, k, peerIds))
      )
    );
    if (keys.length === 0) return [];

    const [latestGroups, reads] = await Promise.all([
      prismadb.teamChatMessage.groupBy({
        by: ["roomKey"],
        where: { roomKey: { in: keys } },
        _max: { createdAt: true },
      }),
      prismadb.teamChatRead.findMany({
        where: { userId, roomKey: { in: keys } },
        select: { roomKey: true, lastReadAt: true },
      }),
    ]);

    const latestWhere = latestGroups
      .filter((g) => g._max.createdAt)
      .map((g) => ({ roomKey: g.roomKey, createdAt: g._max.createdAt! }));

    const latestRows = latestWhere.length
      ? await prismadb.teamChatMessage.findMany({
          where: { OR: latestWhere },
          select: {
            roomKey: true,
            body: true,
            createdAt: true,
            userId: true,
            user: { select: { name: true } },
          },
        })
      : [];

    const readMap = new Map(reads.map((r) => [r.roomKey, r.lastReadAt]));
    const unreadGroups = await prismadb.teamChatMessage.groupBy({
      by: ["roomKey"],
      where: {
        userId: { not: userId },
        OR: keys.map((roomKey) => ({
          roomKey,
          createdAt: { gt: readMap.get(roomKey) ?? new Date(0) },
        })),
      },
      _count: { _all: true },
    });

    const unreadMap = new Map(unreadGroups.map((g) => [g.roomKey, g._count._all]));
    const latestMap = new Map(latestRows.map((r) => [r.roomKey, r]));

    return keys.map((roomKey) => {
      const row = latestMap.get(roomKey);
      const text = row?.body?.replace(/\s+/g, " ").trim() ?? "";
      return {
        roomKey,
        lastBody: text ? text.slice(0, 140) : null,
        lastAt: row?.createdAt.toISOString() ?? null,
        lastUserId: row?.userId ?? null,
        lastUserName: row?.user?.name?.trim() || null,
        unread: unreadMap.get(roomKey) ?? 0,
      };
    });
  } catch (error) {
    console.error("[getChatInboxPreviews] Failed:", error);
    return [];
  }
}
