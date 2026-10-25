"use client";

import * as React from "react";
import { format, isThisWeek, isToday, isYesterday } from "date-fns";
import { Search, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { TeamMember } from "@/actions/team/get-team-directory";
import type { ChatInboxPreview } from "@/actions/chat/inbox";
import { dmRoomKey, GENERAL_CHAT_ROOM } from "@/lib/chat/room-keys";
import { avatarGradientClass, initials } from "@/lib/chat/avatar-style";
import { cn } from "@/lib/utils";

export function formatChatListTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, "EEEE");
  return format(d, "M/d/yy");
}

export function chatPreviewLine(
  preview: ChatInboxPreview | undefined,
  mode: "dm" | "general",
  currentUserId?: string
): string {
  if (!preview?.lastBody) return mode === "general" ? "Team channel" : "Say hello";
  if (mode === "dm") return preview.lastBody;
  const viewer = currentUserId?.trim().toLowerCase();
  const mine = Boolean(viewer) && preview.lastUserId?.toLowerCase() === viewer;
  const who = mine ? "You" : preview.lastUserName?.split(" ")[0] || "Team";
  return `${who}: ${preview.lastBody}`;
}

function Avatar({ name, id }: { name: string; id: string }) {
  return (
    <span
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
        avatarGradientClass(id)
      )}
    >
      {initials(name)}
    </span>
  );
}

export function ChatInbox({
  team,
  currentUserId,
  previews,
}: {
  team: TeamMember[];
  currentUserId: string;
  previews: ChatInboxPreview[];
}) {
  const [query, setQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const q = query.trim().toLowerCase();
  const byRoom = React.useMemo(() => new Map(previews.map((p) => [p.roomKey, p])), [previews]);

  const people = team
    .filter((m) => m.id !== currentUserId)
    .map((m) => {
      const roomKey = dmRoomKey(currentUserId, m.id);
      return { member: m, roomKey, preview: byRoom.get(roomKey) };
    })
    .filter(({ member, preview }) => {
      if (unreadOnly && !(preview && preview.unread > 0)) return false;
      if (!q) return true;
      return (
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.workEmail?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => {
      const at = a.preview?.lastAt ? new Date(a.preview.lastAt).getTime() : 0;
      const bt = b.preview?.lastAt ? new Date(b.preview.lastAt).getTime() : 0;
      if (bt !== at) return bt - at;
      return a.member.name.localeCompare(b.member.name);
    });

  const general = byRoom.get(GENERAL_CHAT_ROOM);
  const showGeneral =
    (!unreadOnly || (general?.unread ?? 0) > 0) &&
    (!q || "general".includes(q));

  const empty = !showGeneral && people.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#111b21] dark:text-[#e9edef]">Chats</h1>
      </div>
      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-lg bg-[#f0f2f5] pl-9 pr-3 text-sm text-[#111b21] outline-none placeholder:text-[#667781] dark:bg-[#202c33] dark:text-[#e9edef]"
          />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 px-3 pb-2">
        {(["All", "Unread"] as const).map((label) => {
          const on = label === "Unread" ? unreadOnly : !unreadOnly;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setUnreadOnly(label === "Unread")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                on
                  ? "bg-[#d9fdd3] text-[#008069] dark:bg-[#005c4b] dark:text-[#e9edef]"
                  : "bg-[#f0f2f5] text-[#54656f] dark:bg-[#202c33] dark:text-[#8696a0]"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <p className="px-6 py-16 text-center text-sm text-[#667781]">No chats match that filter.</p>
        ) : (
          <ul>
            {showGeneral && (
              <li>
                <Link href="/chat?room=general" className="flex items-center gap-3 px-3 active:bg-black/5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white">
                    <Users className="h-6 w-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-3 border-b border-black/5 py-3 dark:border-white/10">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[16px] text-[#111b21] dark:text-[#e9edef]",
                            (general?.unread ?? 0) > 0 ? "font-semibold" : "font-medium"
                          )}
                        >
                          General
                        </span>
                        {general?.lastAt && (
                          <span
                            className={cn(
                              "shrink-0 text-[11px]",
                              (general.unread ?? 0) > 0 ? "font-medium text-[#25d366]" : "text-[#667781]"
                            )}
                          >
                            {formatChatListTime(general.lastAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">
                          {chatPreviewLine(general, "general", currentUserId)}
                        </span>
                        {(general?.unread ?? 0) > 0 && <Unread count={general!.unread} />}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            )}
            {people.map(({ member, roomKey, preview }) => (
              <li key={member.id}>
                <Link
                  href={`/chat?userId=${member.id}`}
                  className="flex items-center gap-3 px-3 active:bg-black/5"
                >
                  <Avatar name={member.name} id={member.id} />
                  <span className="flex min-w-0 flex-1 items-center border-b border-black/5 py-3 dark:border-white/10">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[16px] text-[#111b21] dark:text-[#e9edef]",
                            (preview?.unread ?? 0) > 0 ? "font-semibold" : "font-medium"
                          )}
                        >
                          {member.name}
                        </span>
                        {preview?.lastAt && (
                          <span
                            className={cn(
                              "shrink-0 text-[11px]",
                              (preview.unread ?? 0) > 0 ? "font-medium text-[#25d366]" : "text-[#667781]"
                            )}
                          >
                            {formatChatListTime(preview.lastAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">
                          {chatPreviewLine(preview, "dm")}
                        </span>
                        {(preview?.unread ?? 0) > 0 && <Unread count={preview!.unread} />}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Unread({ count }: { count: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1 text-[11px] font-semibold leading-none text-[#111b21]">
      {count > 99 ? "99+" : count}
    </span>
  );
}
