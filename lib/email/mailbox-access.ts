import { cache } from "react";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { getBootstrapAdminEmail, getBootstrapAdminSeedConfig } from "@/lib/bootstrap-admin-config";

export type MailboxAccessKind = "owner" | "delegate" | "admin";

export type MailboxAccess = {
  accountId: string;
  mailboxUserId: string;
  accessKind: MailboxAccessKind;
  canSend: boolean;
  username: string;
  fromName: string | null;
  label: string;
  sendProvider: import("@prisma/client").EmailSendProvider;
};

/**
 * Checks whether a user entity qualifies for elevated (global) mailbox access.
 * Policy: ONLY ceo@vensailabs.in (or configured bootstrap admin) with the admin role
 * has access to view/use all company mailboxes.
 */
export function isCeoOrSuperAdminUser(
  user: {
    email?: string | null;
    workEmail?: string | null;
    role?: string | null;
  } | null | undefined
): boolean {
  if (!user || user.role !== "admin") return false;

  const adminWorkEmail = getBootstrapAdminSeedConfig().workEmail.trim().toLowerCase();
  const adminEmail = getBootstrapAdminEmail().trim().toLowerCase();

  const userEmail = user.email?.trim().toLowerCase();
  const userWorkEmail = user.workEmail?.trim().toLowerCase();

  const extraSuperAdmins = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return (
    userEmail === "ceo@vensailabs.in" ||
    userWorkEmail === "ceo@vensailabs.in" ||
    userEmail === adminWorkEmail ||
    userWorkEmail === adminWorkEmail ||
    userEmail === adminEmail ||
    userWorkEmail === adminEmail ||
    (userEmail ? extraSuperAdmins.includes(userEmail) : false) ||
    (userWorkEmail ? extraSuperAdmins.includes(userWorkEmail) : false)
  );
}

/**
 * Cached per-request check for elevated mailbox access by userId.
 */
export const isMailboxAdmin = cache(async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  const user = await prismadb.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true, workEmail: true, role: true },
  });
  return isCeoOrSuperAdminUser(user);
});

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
      delegateUserIds: true,
      isActive: true,
    },
  });
  if (!account || !account.isActive) throw new Error("Account not found");

  if (account.userId === sessionUserId) {
    return {
      accountId: account.id,
      mailboxUserId: account.userId,
      accessKind: "owner",
      canSend: true,
      username: account.username,
      fromName: account.fromName,
      label: account.label,
      sendProvider: account.sendProvider,
    };
  }

  if (account.delegateUserIds.includes(sessionUserId)) {
    return {
      accountId: account.id,
      mailboxUserId: account.userId,
      accessKind: "delegate",
      canSend: true,
      username: account.username,
      fromName: account.fromName,
      label: account.label,
      sendProvider: account.sendProvider,
    };
  }

  const elevated = await isMailboxAdmin(sessionUserId);
  if (elevated) {
    return {
      accountId: account.id,
      mailboxUserId: account.userId,
      accessKind: "admin",
      canSend: true,
      username: account.username,
      fromName: account.fromName,
      label: account.label,
      sendProvider: account.sendProvider,
    };
  }

  throw new Error("Account not found");
}

/** Per-request dedupe (parallel getMailboxEmails + getMailboxCounts on the same page load). */
export const resolveMailboxAccess = cache(resolveMailboxAccessUncached);
