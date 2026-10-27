"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Feedback from "./Feedback";
import { HeaderMailButton } from "./HeaderMailButton";
import { HeaderNotifications } from "./HeaderNotifications";
import { HeaderChatPanel } from "./HeaderChatPanel";
import { HeaderProfileMenu } from "./HeaderProfileMenu";

const CrmAssistantSheet = dynamic(
  () =>
    import("@/components/assistant/CrmAssistantSheet").then((m) => m.CrmAssistantSheet),
  { ssr: false, loading: () => null }
);

const FulltextSearch = dynamic(() => import("./FulltextSearch"), {
  ssr: false,
  loading: () => <div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-muted/60" />,
});

const CommandComponent = dynamic(
  () => import("@/components/CommandComponent").then((m) => m.CommandComponent),
  { ssr: false, loading: () => null }
);
import type { HeaderNotificationItem } from "@/actions/notifications/header-notifications";
import type { LiveSummary } from "@/hooks/use-live-summary";
import { useLiveSummary } from "@/hooks/use-live-summary";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SetLanguage } from "@/components/SetLanguage";
import { ThemeToggle } from "@/components/ThemeToggle";
type HeaderUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

type Props = {
  user: HeaderUser;
  initialLive: LiveSummary & { items: HeaderNotificationItem[] };
};

export function HeaderLive({ user, initialLive }: Props) {
  const { data } = useLiveSummary(initialLive);
  const live = data ?? initialLive;
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 mt-2 mb-3.5 flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-border/50 bg-background px-2 sm:mt-3 sm:mb-4.5 sm:gap-3 sm:px-5">
      {searchOpen ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
          <div className="min-w-0 flex-1">
            <FulltextSearch autoFocus />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div className={searchOpen ? "hidden min-w-0 flex-1 items-center gap-2 sm:flex sm:gap-3" : "flex min-w-0 flex-1 items-center gap-2 sm:gap-3"}>
        <SidebarTrigger className="-ml-0.5 hidden h-9 w-9 shrink-0 rounded-xl md:inline-flex" />
        <Separator orientation="vertical" className="hidden h-5 sm:block" />
        <div className="hidden min-w-0 flex-1 sm:block">
          <FulltextSearch />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl sm:hidden"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className={`${searchOpen ? "hidden sm:flex" : "flex"} shrink-0 items-center gap-0.5 rounded-2xl border border-border/50 bg-muted/25 p-0.5 sm:gap-1 sm:p-1 mb-1 sm:mb-1.5 shadow-2xs`}>
        <div className="hidden sm:flex">
          <CrmAssistantSheet />
        </div>
        <HeaderMailButton unreadCount={live.emailUnreadCount} />
        <HeaderChatPanel unreadCount={live.chatUnreadCount} />
        <HeaderNotifications totalCount={live.notificationCount} items={live.items} />
        <Separator orientation="vertical" className="mx-0.5 hidden h-5 sm:block" />
        <div className="hidden items-center sm:flex">
          <CommandComponent />
          <SetLanguage userId={user.id} />
        </div>
        <div className="hidden md:flex">
          <Feedback />
        </div>
        <ThemeToggle />
        <HeaderProfileMenu user={user} />
      </div>
    </header>
  );
}
