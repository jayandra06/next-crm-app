"use server";

import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { requireRole, AuthorizationError } from "@/lib/authz";
import { prismadb } from "@/lib/prisma";
import { serializeDecimals, serializeDecimalsList } from "@/lib/serialize-decimals";
import type { MailboxAccessKind } from "@/lib/email/mailbox-access";
import {
  accessFromDelegatePermission,
  type DelegatePermission,
} from "@/lib/email/delegation";

export type AccessibleEmailAccount = {
  id: string;
  label: string;
  username: string;
  fromName: string | null;
  accessKind: MailboxAccessKind;
  canSend: boolean;
  sendStyle: "owner" | "send_as" | "on_behalf";
  delegatePermission: DelegatePermission | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

const accountSelect = {
  id: true,
  label: true,
  username: true,
  fromName: true,
  userId: true,
  user: { select: { name: true, email: true } },
  delegates: {
    select: { userId: true, permission: true },
  },
} as const;

function toAccessible(
  a: {
    id: string;
    label: string;
    username: string;
    fromName: string | null;
    userId: string;
    user: { name: string | null; email: string };
    delegates: { userId: string; permission: DelegatePermission }[];
  },
  userId: string
): AccessibleEmailAccount {
  const grant = a.delegates.find((d) => d.userId === userId)?.permission ?? null;
  let accessKind: MailboxAccessKind = "delegate";
  let canSend = false;
  let sendStyle: AccessibleEmailAccount["sendStyle"] = "send_as";
  if (a.userId === userId) {
    accessKind = "owner";
    canSend = true;
    sendStyle = "owner";
  } else if (grant) {
    const granted = accessFromDelegatePermission(grant);
    canSend = granted.canSend;
    sendStyle = granted.sendStyle;
  }

  return {
    id: a.id,
    label: a.label,
    username: a.username,
    fromName: a.fromName,
    accessKind,
    canSend,
    sendStyle,
    delegatePermission: a.userId === userId ? null : grant,
    ownerName: a.user.name,
    ownerEmail: a.user.email,
  };
}

async function loadAccessibleAccounts(userId: string): Promise<AccessibleEmailAccount[]> {
  const rows = await prismadb.emailAccount.findMany({
    where: {
      isActive: true,
      OR: [{ userId }, { delegates: { some: { userId } } }],
    },
    select: {
      ...accountSelect,
      delegates: { where: { userId }, select: { userId: true, permission: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((a) => toAccessible(a, userId));
}

function cachedAccountsForUser(userId: string) {
  return unstable_cache(
    async () => loadAccessibleAccounts(userId),
    ["accessible-email-accounts-v3", userId],
    { revalidate: 120, tags: [`accessible-email-accounts:${userId}`] }
  )();
}

/** Mailboxes in the switcher: your own, plus ones explicitly delegated to you. */
export async function getAccessibleEmailAccounts(): Promise<AccessibleEmailAccount[]> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return [];
  return serializeDecimalsList(await cachedAccountsForUser(userId));
}

async function requireAdminUser() {
  try {
    return await requireRole(["admin"]);
  } catch (e) {
    if (e instanceof AuthorizationError) throw new Error("Forbidden");
    throw new Error("Unauthorized");
  }
}

/** One mailbox an admin opened by search. Not included in the short switcher list. */
export async function getAdminMailboxById(accountId: string): Promise<AccessibleEmailAccount | null> {
  const admin = await requireAdminUser();
  const account = await prismadb.emailAccount.findFirst({
    where: { id: accountId, isActive: true },
    select: {
      ...accountSelect,
      delegates: { where: { userId: admin.id }, select: { userId: true, permission: true } },
    },
  });
  if (!account) return null;
  const mapped = toAccessible(account, admin.id);
  if (mapped.accessKind === "owner") return serializeDecimals(mapped);
  return serializeDecimals({
    ...mapped,
    accessKind: "admin" as const,
    canSend: true,
    sendStyle: "send_as" as const,
    delegatePermission: null,
  });
}

/** Admin mailbox search. Returns a short match list, not every mailbox. */
export async function searchMailboxesForAdmin(query: string): Promise<AccessibleEmailAccount[]> {
  const admin = await requireAdminUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await prismadb.emailAccount.findMany({
    where: {
      isActive: true,
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { label: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { workEmail: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      ...accountSelect,
      delegates: { where: { userId: admin.id }, select: { userId: true, permission: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { username: "asc" }],
    take: 8,
  });

  return serializeDecimalsList(
    rows.map((a) => {
      const mapped = toAccessible(a, admin.id);
      if (mapped.accessKind === "owner") return mapped;
      return {
        ...mapped,
        accessKind: "admin" as const,
        canSend: true,
        sendStyle: "send_as" as const,
        delegatePermission: null,
      };
    })
  );
}
