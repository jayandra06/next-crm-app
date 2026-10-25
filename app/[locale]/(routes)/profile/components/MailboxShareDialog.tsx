"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addMailboxDelegate,
  removeMailboxDelegate,
  type MailboxDelegate,
} from "@/actions/emails/delegates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserSearchField } from "./UserSearchField";

export function MailboxShareDialog({
  open,
  onOpenChange,
  account,
  ownerId,
  delegates,
  onDelegatesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string; label: string; username: string; ownerName?: string | null };
  ownerId?: string | null;
  delegates: MailboxDelegate[];
  onDelegatesChange: (next: MailboxDelegate[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add(person: MailboxDelegate) {
    if (delegates.some((d) => d.id === person.id)) return;
    setBusyId(person.id);
    try {
      const next = await addMailboxDelegate(account.id, person.id);
      onDelegatesChange(next);
      toast.success(`${person.name} can now open ${account.username}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share this mailbox");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(person: MailboxDelegate) {
    setBusyId(person.id);
    try {
      const next = await removeMailboxDelegate(account.id, person.id);
      onDelegatesChange(next);
      toast.success(`Removed ${person.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove access");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delegate access</DialogTitle>
          <DialogDescription>
            {account.label} · {account.username}. Type the email of someone who already logs into
            this organization. They can read this inbox and send from this address. They cannot
            delete the mailbox or change who else has access.
          </DialogDescription>
        </DialogHeader>

        <UserSearchField
          excludeIds={[...delegates.map((person) => person.id), ...(ownerId ? [ownerId] : [])]}
          disabled={busyId !== null}
          onPick={(person) => void add(person)}
          placeholder="Type their email in this organization"
        />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Has access
          </p>
          {delegates.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
              Only the mailbox owner can open this inbox right now.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {delegates.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.workEmail && person.workEmail !== person.email
                        ? `${person.email} · ${person.workEmail}`
                        : person.email}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={busyId !== null}
                    aria-label={`Remove ${person.name}`}
                    onClick={() => void remove(person)}
                  >
                    {busyId === person.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
