"use client";

import { useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { primeEmailDetail } from "@/lib/email/client-email-cache";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MAILBOX_PAGE_SIZE } from "@/lib/email/mailbox-constants";
import type { Mail } from "@/app/[locale]/(routes)/emails/data";
import { useMail } from "@/app/[locale]/(routes)/emails/use-mail";
import { setEmailStarred } from "@/actions/emails/mailbox-actions";
import type { MailboxView } from "@/lib/email/mailbox-views";

interface MailListProps {
  items: Mail[];
  page: number;
  totalPages: number;
  total: number;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  mailboxView?: MailboxView;
  onPatchMail?: (id: string, patch: Partial<Mail>) => void;
  onRemoveMail?: (id: string) => void;
  onOpen?: (id: string) => void;
}

export function MailList({
  items,
  page,
  totalPages,
  total,
  selectedIds,
  onSelectedIdsChange,
  mailboxView = "inbox",
  onPatchMail,
  onRemoveMail,
  onOpen,
}: MailListProps) {
  const [mail, setMail] = useMail();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefetchedIds = useRef(new Set<string>());

  function shortWhen(sentAt: string | Date) {
    const d = new Date(sentAt);
    if (Number.isNaN(d.getTime())) return "";
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d`;
    return format(d, "MMM d");
  }

  function prefetchMessage(id: string) {
    if (prefetchedIds.current.has(id)) return;
    prefetchedIds.current.add(id);
    primeEmailDetail(id);
  }

  const safeTotalPages = Math.max(totalPages, total > 0 ? 1 : 0);
  const rangeStart = total === 0 ? 0 : (page - 1) * MAILBOX_PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * MAILBOX_PAGE_SIZE, total);

  function navigate(toPage: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(toPage));
    router.push(`?${p.toString()}`);
  }

  function toggleRow(id: string) {
    onSelectedIdsChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  }

  async function toggleStar(e: React.MouseEvent, item: Mail) {
    e.stopPropagation();
    const next = !item.isStarred;
    onPatchMail?.(item.id, { isStarred: next });
    if (mailboxView === "starred" && !next) onRemoveMail?.(item.id);
    try {
      await setEmailStarred(item.id, next);
    } catch (err) {
      console.error(err);
      onPatchMail?.(item.id, { isStarred: !next });
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col">
          {items.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No messages</p>
          )}
          {items.map((item) => {
            const who = item.fromName ?? item.fromEmail ?? "?";
            const initials = who
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("");
            return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              className={cn(
                "flex items-start gap-3 border-b border-border/40 px-3 py-3 text-left text-sm transition-colors active:bg-muted/60 lg:gap-2 lg:rounded-lg lg:border lg:border-transparent lg:px-2.5 lg:py-2.5",
                mail.selected === item.id && "bg-primary/[0.06] lg:border-primary/20 lg:shadow-sm",
                !item.isRead && mail.selected !== item.id && "bg-background"
              )}
              onClick={() => {
                setMail({ ...mail, selected: item.id });
                onOpen?.(item.id);
              }}
              onMouseEnter={() => prefetchMessage(item.id)}
              onFocus={() => prefetchMessage(item.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setMail({ ...mail, selected: item.id });
                  onOpen?.(item.id);
                }
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary lg:hidden"
                aria-hidden
              >
                {initials || "?"}
              </div>
              <Checkbox
                checked={selectedIds.includes(item.id)}
                onCheckedChange={() => toggleRow(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 hidden shrink-0 lg:flex"
                aria-label={`Select ${item.subject ?? "message"}`}
              />
              <button
                type="button"
                className="mt-0.5 hidden shrink-0 text-muted-foreground hover:text-amber-500 lg:inline-flex"
                onClick={(e) => toggleStar(e, item)}
                aria-label={item.isStarred ? "Unstar" : "Star"}
              >
                <Star
                  className={cn("h-4 w-4", item.isStarred && "fill-amber-400 text-amber-500")}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">
                    {item.fromName ?? item.fromEmail ?? "Unknown"}
                  </div>
                  {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="ml-auto shrink-0 text-xs text-muted-foreground sm:hidden">
                    {item.sentAt ? shortWhen(item.sentAt) : ""}
                  </div>
                  <div className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {item.sentAt
                      ? formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })
                      : ""}
                  </div>
                </div>
                <div
                  className={cn(
                    "truncate text-[13px] leading-snug text-muted-foreground",
                    !item.isRead && "font-medium text-foreground/80"
                  )}
                >
                  {item.subject ?? "(no subject)"}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/40 bg-background px-3 py-2 shadow-[0_-1px_0_0_hsl(var(--border)/0.4)]">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          disabled={page <= 1 || total === 0}
          onClick={() => navigate(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <div className="min-w-0 text-center text-[11px] leading-tight text-muted-foreground">
          <div className="font-medium text-foreground/90">
            {total === 0 ? "0 messages" : `${rangeStart}–${rangeEnd} of ${total}`}
          </div>
          {safeTotalPages > 1 && (
            <div>
              Page {page} / {safeTotalPages}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          disabled={page >= safeTotalPages || total === 0}
          onClick={() => navigate(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
