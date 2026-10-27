"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { requireAuthenticated } from "@/lib/authz";
import { loadMailboxDelegates, type MailboxDelegate } from "@/lib/email/mailbox-delegates";
import { isMailboxAdmin } from "@/lib/email/mailbox-access";

export type { MailboxDelegate };

function refreshMailboxAccess() {
  revalidateTag("accessible-email-accounts", "max");
  revalidatePath("/emails");
  revalidatePath("/profile");
  revalidatePath("/admin/email-accounts");
  revalidatePath("/[locale]/(routes)/emails", "page");
  revalidatePath("/[locale]/(routes)/admin/email-accounts", "page");
}

async function mailboxForDelegateEdit(accountId: string) {
  const actor = await requireAuthenticated();
  const account = await prismadb.emailAccount.findUnique({
    where: { id: accountId },
    select: { id: true, userId: true, username: true, label: true, delegateUserIds: true },
  });
  if (!account) throw new Error("Mailbox not found");
  if (account.userId === actor.id) return account;
  const elevated = await isMailboxAdmin(actor.id);
  if (elevated) return account;
  throw new Error("You can share a mailbox you own. Only the CEO can manage delegated access for any mailbox.");
}

export async function searchUsersForMailboxShare(query: string = ""): Promise<MailboxDelegate[]> {
  await requireAuthenticated();
  const q = query.trim();

  const users = await prismadb.users.findMany({
    where: {
      userStatus: "ACTIVE",
      banned: false,
      ...(q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { workEmail: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, workEmail: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: q.length > 0 ? 10 : 30,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name?.trim() || u.email,
    email: u.email,
    workEmail: u.workEmail,
  }));
}

export async function getActiveTeamUsersForDelegation(): Promise<MailboxDelegate[]> {
  return searchUsersForMailboxShare("");
}

export async function addMailboxDelegate(accountId: string, userId: string): Promise<MailboxDelegate[]> {
  const account = await mailboxForDelegateEdit(accountId);
  const personId = userId.trim();
  if (!personId) throw new Error("Choose a person");
  if (personId === account.userId) throw new Error("The mailbox owner already has access");

  const person = await prismadb.users.findFirst({
    where: { id: personId, userStatus: "ACTIVE", banned: false },
    select: { id: true },
  });
  if (!person) throw new Error("That person is not an active CRM user");

  const next = Array.from(new Set([...(account.delegateUserIds ?? []), person.id]));
  await prismadb.emailAccount.update({
    where: { id: account.id },
    data: { delegateUserIds: next },
  });
  refreshMailboxAccess();
  return loadMailboxDelegates(next);
}

export async function removeMailboxDelegate(accountId: string, userId: string): Promise<MailboxDelegate[]> {
  const account = await mailboxForDelegateEdit(accountId);
  const next = (account.delegateUserIds ?? []).filter((id) => id !== userId);
  await prismadb.emailAccount.update({
    where: { id: account.id },
    data: { delegateUserIds: next },
  });
  refreshMailboxAccess();
  return loadMailboxDelegates(next);
}
