"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Hash, Search } from "lucide-react";
import type { TeamMember } from "@/actions/team/get-team-directory";
import type { ChatInboxPreview } from "@/actions/chat/inbox";
import { dmRoomKey, GENERAL_CHAT_ROOM } from "@/lib/chat/room-keys";
import { avatarGradientClass, initials } from "@/lib/chat/avatar-style";
import { ChatInbox, chatPreviewLine, formatChatListTime } from "./ChatInbox";
import { ChatWorkspace } from "./ChatWorkspace";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  team: TeamMember[];
  currentUserId: string;
  roomKey: string;
  roomTitle: string;
  displayName: string;
  meetRoom: string;
  initialCallOpen?: boolean;
  initialDraft?: string;
  previews?: ChatInboxPreview[];
  mobileHome?: boolean;
};

function useMinMd() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

function MemberAvatar({ name, id, size = "md" }: { name: string; id: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm",
        avatarGradientClass(id),
        sz
      )}
    >
      {initials(name)}
    </span>
  );
}

export function ChatShell({
  team,
  currentUserId,
  roomKey,
  roomTitle,
  displayName,
  meetRoom,
  initialCallOpen,
  initialDraft,
  previews = [],
  mobileHome = false,
}: Props) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const byRoom = React.useMemo(() => new Map(previews.map((p) => [p.roomKey, p])), [previews]);
  const isDesktop = useMinMd();
  const showThread = isDesktop || !mobileHome;
  const dms = team.filter((m) => m.id !== currentUserId);

  React.useEffect(() => {
    const reading = !isDesktop && !mobileHome;
    if (reading) document.body.dataset.chatReading = "true";
    else delete document.body.dataset.chatReading;
    return () => {
      delete document.body.dataset.chatReading;
    };
  }, [isDesktop, mobileHome]);
  const filtered = dms.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  );

  const isGeneral = roomKey === GENERAL_CHAT_ROOM;
  const activeMember = dms.find((m) => roomKey === dmRoomKey(currentUserId, m.id));

  const generalPreview = byRoom.get(GENERAL_CHAT_ROOM);
  const activePeer = activeMember;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background md:rounded-xl md:border md:border-border/70">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        {mobileHome && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
            <ChatInbox team={team} currentUserId={currentUserId} previews={previews} />
          </div>
        )}

        <aside className="hidden w-[300px] shrink-0 flex-col border-r border-border/60 bg-muted/20 md:flex">
          <div className="px-3 pb-2 pt-4">
            <p className="mb-3 px-1 text-sm font-semibold">Messages</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="h-9 border-border/50 bg-background/80 pl-8 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-2">
              <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Channels
              </p>
              <Link
                href="/chat"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  isGeneral
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Hash className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">General</span>
                    {generalPreview?.lastAt && (
                      <span className="shrink-0 text-[10px] opacity-70">
                        {formatChatListTime(generalPreview.lastAt)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="block truncate text-xs opacity-70">
                      {chatPreviewLine(generalPreview, "general", currentUserId)}
                    </span>
                    {(generalPreview?.unread ?? 0) > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-semibold text-[#111b21]">
                        {generalPreview!.unread > 99 ? "99+" : generalPreview!.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>

              <p className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Direct messages
              </p>
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</p>
              ) : (
                filtered.map((m) => {
                  const active = roomKey === dmRoomKey(currentUserId, m.id);
                  const preview = byRoom.get(dmRoomKey(currentUserId, m.id));
                  return (
                    <Link
                      key={m.id}
                      href={`/chat?userId=${m.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      )}
                    >
                      <MemberAvatar name={m.name} id={m.id} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{m.name}</span>
                          {preview?.lastAt && (
                            <span className="shrink-0 text-[10px] opacity-70">
                              {formatChatListTime(preview.lastAt)}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="block truncate text-xs opacity-70">
                            {chatPreviewLine(preview, "dm")}
                          </span>
                          {(preview?.unread ?? 0) > 0 && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-semibold text-[#111b21]">
                              {preview!.unread > 99 ? "99+" : preview!.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {showThread && (
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatWorkspace
            roomKey={roomKey}
            roomTitle={roomTitle}
            displayName={displayName}
            meetRoom={meetRoom}
            currentUserId={currentUserId}
            initialCallOpen={initialCallOpen}
            initialDraft={initialDraft}
            peerName={activePeer?.name}
            peerDetail={activePeer?.workEmail || activePeer?.email}
            isGeneral={isGeneral}
          />
        </main>
        )}
      </div>
    </div>
  );
}
