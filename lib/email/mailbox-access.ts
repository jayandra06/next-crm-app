import { cache } from "react";
import { getSession } from "@/lib/auth-server";
import { mapLegacyRole } from "@/lib/authz/roles";
import { prismadb } from "@/lib/prisma";
import { accessFromDelegatePermission, type DelegatePermission } from "@/lib/email/delegation";

export type MailboxAccessKind = "owner" | "delegate" | "admin";

export type MailboxAccess = {
  accountId: string;
  mailboxUserId: string;
  accessKind: MailboxAccessKind;
  canSend: boolean;
  /** owner sends as the mailbox. on_behalf prefixes the From name. */
  sendStyle: "owner" | "send_as" | "on_behalf";
  delegatePermission: DelegatePermission | null;
  username: string;
  fromName: string | null;
  label: string;
  sendProvider: import("@prisma/client").EmailSendProvider;
};

function viewerIsAdmin(sessionRole: unknown): boolean {
  return mapLegacyRole(sessionRole) === "admin";
}

async function resolveMailboxAccessUncached(accountId: string): Promise<MailboxAccess> {
  const session = await getSession();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) throw new Error("Unauthorized");

  const account = await prismadb.emailAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      userId: true,
      username: true,
      fromName: true,
      label: true,
      sendProvider: true,
      isActive: true,
      delegates: {
        where: { userId: sessionUserId },
        select: { permission: true },
        take: 1,
      },
    },
  });
  if (!account || !account.isActive) throw new Error("Account not found");

  const base = {
    accountId: account.id,
    mailboxUserId: account.userId,
    username: account.username,
    fromName: account.fromName,
    label: account.label,
    sendProvider: account.sendProvider,
  };

  if (account.userId === sessionUserId) {
    return {
      ...base,
      accessKind: "owner",
      canSend: true,
      sendStyle: "owner",
      delegatePermission: null,
    };
  }

  // Admins can open and send from every mailbox without a grant.
  if (viewerIsAdmin(session.user.role)) {
    return {
      ...base,
      accessKind: "admin",
      canSend: true,
      sendStyle: "send_as",
      delegatePermission: null,
    };
  }

  const grant = account.delegates[0]?.permission;
  if (grant) {
    const granted = accessFromDelegatePermission(grant);
    return {
      ...base,
      accessKind: "delegate",
      canSend: granted.canSend,
      sendStyle: granted.sendStyle,
      delegatePermission: grant,
    };
  }

  throw new Error("Account not found");
}

/** Per-request dedupe (parallel getMailboxEmails + getMailboxCounts on the same page load). */
export const resolveMailboxAccess = cache(resolveMailboxAccessUncached);
