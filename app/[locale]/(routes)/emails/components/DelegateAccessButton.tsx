"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MailboxShareDialog } from "@/app/[locale]/(routes)/profile/components/MailboxShareDialog";
import type { MailboxDelegate } from "@/actions/emails/delegates";
import type { ConnectedAccount } from "@/app/[locale]/(routes)/emails/data";
import { cn } from "@/lib/utils";

export function DelegateAccessButton({
  account,
  className,
  compact = false,
}: {
  account: ConnectedAccount | undefined;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delegates, setDelegates] = useState<MailboxDelegate[]>(account?.delegates ?? []);

  useEffect(() => {
    setDelegates(account?.delegates ?? []);
  }, [account?.id, account?.delegates]);

  if (!account || account.accessKind === "delegate") return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(compact ? "h-8 shrink-0 gap-1 px-2 text-xs" : "h-8 w-full gap-1.5 text-xs", className)}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-3.5 w-3.5 shrink-0" />
        Delegate
      </Button>
      <MailboxShareDialog
        open={open}
        onOpenChange={setOpen}
        account={{
          id: account.id,
          label: account.label,
          username: account.username,
          ownerName: account.ownerName,
        }}
        ownerId={account.ownerId}
        delegates={delegates}
        onDelegatesChange={(next) => {
          setDelegates(next);
          router.refresh();
        }}
      />
    </>
  );
}
