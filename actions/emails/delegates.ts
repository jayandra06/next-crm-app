"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { requireRole, AuthorizationError } from "@/lib/authz";
import { getSession } from "@/lib/auth-server";
import {
  isDelegatePermission,
  type DelegatePermission,
} from "@/lib/email/delegation";

export type MailboxDelegateGrant = {
  id: string;
  accountId: string;
  accountLabel: string;
  accountEmail: string;
  userId: string;
  name: string | null;
  email: string;
  permission: DelegatePermission;
};

export type DelegationUserMatch = {
  id: string;
  name: string | null;
  email: string;
  mailboxes: { id: string; label: string; username: string }[];
};

function bustAccess(userIds: string[]) {
  for (const id of userIds) {
    if (id) revalidateTag(`accessible-email-accounts:${id}`, "max");
  }
  revalidatePath("/[locale]/(routes)/emails", "page");
  revalidatePath("/[locale]/(routes)/profile", "page");
  revalidatePath("/[locale]/(routes)/admin/email-accounts", "page");
}

async function sessionUser() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  let admin = false;
  try {
    await requireRole(["admin"]);
    admin = true;
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  return { userId, admin };
}

async function assertCanManageAccount(accountId: string, actorId: string, admin: boolean) {
  const account = await prismadb.emailAccount.findUnique({
    where: { id: accountId },
    select: { id: true, userId: true, isActive: true, label: true, username: true },
  });
  if (!account || !account.isActive) throw new Error("Mailbox not found");
  if (!admin && account.userId !== actorId) {
    throw new Error("You can only delegate your own mailbox");
  }
  return account;
}

const grantSelect = {
  id: true,
  permission: true,
  userId: true,
  emailAccountId: true,
  user: { select: { name: true, email: true } },
  account: { select: { id: true, label: true, username: true } },
} as const;

function toGrant(row: {
  id: string;
  permission: DelegatePermission;
  userId: string;
  user: { name: string | null; email: string };
  account: { id: string; label: string; username: string };
}): MailboxDelegateGrant {
  return {
    id: row.id,
    accountId: row.account.id,
    accountLabel: row.account.label,
    accountEmail: row.account.username,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    permission: row.permission,
  };
}

export async function listMyMailboxDelegates(): Promise<MailboxDelegateGrant[]> {
  const { userId } = await sessionUser();
  const rows = await prismadb.emailAccountDelegate.findMany({
    where: { account: { userId, isActive: true } },
    select: grantSelect,
    orderBy: [{ account: { username: "asc" } }, { user: { email: "asc" } }],
  });
  return rows.map(toGrant);
}

export async function listDelegatesForAccount(accountId: string): Promise<MailboxDelegateGrant[]> {
  const { userId, admin } = await sessionUser();
  await assertCanManageAccount(accountId, userId, admin);
  const rows = await prismadb.emailAccountDelegate.findMany({
    where: { emailAccountId: accountId },
    select: grantSelect,
    orderBy: { user: { email: "asc" } },
  });
  return rows.map(toGrant);
}

async function findActiveUserByEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return null;
  return prismadb.users.findFirst({
    where: {
      userStatus: "ACTIVE",
      OR: [
        { email: { equals: trimmed, mode: "insensitive" } },
        { workEmail: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, name: true },
  });
}

export async function grantMailboxDelegate(input: {
  accountId: string;
  email?: string;
  userId?: string;
  permission: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    if (!isDelegatePermission(input.permission)) return { error: "Choose an access level" };
    const { userId, admin } = await sessionUser();
    const account = await assertCanManageAccount(input.accountId, userId, admin);

    const delegate = input.userId
      ? await prismadb.users.findFirst({
          where: { id: input.userId, userStatus: "ACTIVE" },
          select: { id: true },
        })
      : await findActiveUserByEmail(input.email ?? "");

    if (!delegate) return { error: "No active user with that email" };
    if (delegate.id === account.userId) return { error: "The mailbox owner already has access" };

    await prismadb.emailAccountDelegate.upsert({
      where: {
        emailAccountId_userId: { emailAccountId: account.id, userId: delegate.id },
      },
      create: {
        emailAccountId: account.id,
        userId: delegate.id,
        permission: input.permission,
      },
      update: { permission: input.permission },
    });
    bustAccess([delegate.id, account.userId, userId]);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save delegation" };
  }
}

export async function updateMailboxDelegatePermission(
  delegateId: string,
  permission: string
): Promise<{ ok: true } | { error: string }> {
  try {
    if (!isDelegatePermission(permission)) return { error: "Choose an access level" };
    const { userId, admin } = await sessionUser();
    const row = await prismadb.emailAccountDelegate.findUnique({
      where: { id: delegateId },
      select: { id: true, userId: true, emailAccountId: true, account: { select: { userId: true } } },
    });
    if (!row) return { error: "Delegation not found" };
    await assertCanManageAccount(row.emailAccountId, userId, admin);
    await prismadb.emailAccountDelegate.update({
      where: { id: delegateId },
      data: { permission },
    });
    bustAccess([row.userId, row.account.userId]);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update access" };
  }
}

export async function revokeMailboxDelegate(delegateId: string): Promise<{ ok: true } | { error: string }> {
  try {
    const { userId, admin } = await sessionUser();
    const row = await prismadb.emailAccountDelegate.findUnique({
      where: { id: delegateId },
      select: { id: true, userId: true, emailAccountId: true, account: { select: { userId: true } } },
    });
    if (!row) return { error: "Delegation not found" };
    await assertCanManageAccount(row.emailAccountId, userId, admin);
    await prismadb.emailAccountDelegate.delete({ where: { id: delegateId } });
    bustAccess([row.userId, row.account.userId]);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove access" };
  }
}

/** Admin name search. Short list only — never the full directory. */
export async function searchUsersForDelegation(query: string): Promise<DelegationUserMatch[]> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (e instanceof AuthorizationError) throw new Error("Forbidden");
    throw new Error("Unauthorized");
  }
  const q = query.trim();
  if (q.length < 2) return [];

  const users = await prismadb.users.findMany({
    where: {
      userStatus: "ACTIVE",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { workEmail: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailAccounts: {
        where: { isActive: true },
        select: { id: true, label: true, username: true },
        orderBy: { username: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 8,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mailboxes: u.emailAccounts,
  }));
}
