/** Stable chat room keys stored in TeamChatMessage.roomKey */

export const GENERAL_CHAT_ROOM = "general";

export function dmRoomKey(userIdA: string, userIdB: string): string {
  const a = (userIdA ?? "").trim().toLowerCase();
  const b = (userIdB ?? "").trim().toLowerCase();
  const [sortedA, sortedB] = [a, b].sort();
  return `dm:${sortedA}:${sortedB}`;
}

export function inboxRoomKeys(currentUserId: string, peerIds: string[]): string[] {
  const me = currentUserId.trim().toLowerCase();
  return [
    GENERAL_CHAT_ROOM,
    ...peerIds
      .filter((id) => id.trim().toLowerCase() !== me)
      .map((id) => dmRoomKey(currentUserId, id)),
  ];
}

export function conferenceRoomKey(scheduleId: string): string {
  return `conf:${scheduleId.trim()}`;
}

export function parseRoomKey(raw?: string | null): string {
  if (!raw) return GENERAL_CHAT_ROOM;
  let v = raw.trim();
  try {
    v = decodeURIComponent(v).trim();
  } catch {}
  if (!v || v === GENERAL_CHAT_ROOM) return GENERAL_CHAT_ROOM;
  if (v.startsWith("dm:") || v.startsWith("conf:")) return v;
  return GENERAL_CHAT_ROOM;
}

export function parseAttendeeIds(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string");
}
