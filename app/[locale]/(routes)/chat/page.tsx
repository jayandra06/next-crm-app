import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getCachedTeamDirectory } from "@/lib/server/cached-team";
import { getChatInboxPreviews } from "@/actions/chat/inbox";
import { dmRoomKey, GENERAL_CHAT_ROOM, inboxRoomKeys, parseRoomKey } from "@/lib/chat/room-keys";
import { dmMeetRoomSuffix, teamRoomName } from "@/lib/jitsi/meet-url";
import { ChatShell } from "./components/ChatShell";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; userId?: string; call?: string; draft?: string }>;
}) {
  const [session, params, team] = await Promise.all([
    getSession(),
    searchParams,
    getCachedTeamDirectory(),
  ]);
  if (!session?.user?.id) redirect("/sign-in");

  const userId = session.user.id as string;
  let roomKey = parseRoomKey(params.room);

  if (params.userId) {
    roomKey = dmRoomKey(userId, params.userId);
  }

  const displayName = session.user.name?.trim() || session.user.email || "User";

  const roomTitle =
    roomKey === GENERAL_CHAT_ROOM
      ? "General"
      : roomKey.startsWith("conf:")
        ? "Conference"
        : (team.find((m) => roomKey.toLowerCase().includes(m.id.toLowerCase()))?.name ?? "Direct message");

  const meetRoom =
    roomKey === GENERAL_CHAT_ROOM
      ? teamRoomName("general")
      : teamRoomName("dm", dmMeetRoomSuffix(roomKey));

  const previews = await getChatInboxPreviews(inboxRoomKeys(userId, team.map((m) => m.id)));
  const mobileHome = !params.userId && !params.room && params.call !== "1";

  return (
    <ChatShell
      team={team}
      currentUserId={userId}
      roomKey={roomKey}
      roomTitle={roomTitle}
      displayName={displayName}
      meetRoom={meetRoom}
      initialCallOpen={params.call === "1"}
      initialDraft={params.draft ? decodeURIComponent(params.draft) : undefined}
      previews={previews}
      mobileHome={mobileHome}
    />
  );
}
