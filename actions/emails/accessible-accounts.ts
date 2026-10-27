"use server";

import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { isMailboxAdmin, type MailboxAccessKind } from "@/lib/email/mailbox-access";

export type AccessibleEmailAccount = {
  id: string;
  label: string;
  username: string;
  fromName: string | null;
  accessKind: MailboxAccessKind;
  ownerName: string | null;
  ownerEmail: string | null;
};

const accountSelect = {
  id: true,
  label: true,
  username: true,
  fromName: true,
  userId: true,
  delegateUserIds: true,
  user: { select: { name: true, email: true } },
} as const;

function isJayandraOrCeoAccount(acc: AccessibleEmailAccount): boolean {
  const name = (acc.ownerName || "").toLowerCase();
  const email = (acc.ownerEmail || "").toLowerCase();
  const username = (acc.username || "").toLowerCase();
  const label = (acc.label || "").toLowerCase();
  return (
    name.includes("jayandra") ||
    label.includes("jayandra") ||
    username.includes("ceo@vensailabs.in") ||
    email.includes("ceo@vensailabs.in") ||
    email.includes("jaybabu0610@gmail.com")
  );
}

function sortAccessibleAccounts(
  accounts: AccessibleEmailAccount[],
  userId: string,
  elevated: boolean
): AccessibleEmailAccount[] {
  return [...accounts].sort((a, b) => {
    // 1. If elevated (CEO), prioritize Jayandra's / CEO personal mailbox to the very top
    if (elevated) {
      const aIsCeo = isJayandraOrCeoAccount(a);
      const bIsCeo = isJayandraOrCeoAccount(b);
      if (aIsCeo && !bIsCeo) return -1;
      if (!aIsCeo && bIsCeo) return 1;
    }

    // 2. Owner mailboxes come before delegates and admin
    const accessScore = (acc: AccessibleEmailAccount) => {
      if (acc.accessKind === "owner") return 0;
      if (acc.accessKind === "delegate") return 1;
      return 2; // admin
    };

    const diff = accessScore(a) - accessScore(b);
    if (diff !== 0) return diff;

    // 3. Alphabetical by label or username
    return (a.label || a.username).localeCompare(b.label || b.username);
  });
}

async function loadAccessibleAccounts(
  userId: string,
  elevated: boolean
): Promise<AccessibleEmailAccount[]> {
  const rows = await prismadb.emailAccount.findMany({
    where: elevated
      ? { isActive: true }
      : {
          isActive: true,
          OR: [{ userId }, { delegateUserIds: { has: userId } }],
        },
    select: accountSelect,
    orderBy: elevated
      ? [{ user: { email: "asc" } }, { createdAt: "asc" }]
      : { createdAt: "asc" },
  });

  const mapped = rows.map((a) => {
    let accessKind: MailboxAccessKind = "delegate";
    if (a.userId === userId) accessKind = "owner";
    else if (a.delegateUserIds.includes(userId)) accessKind = "delegate";
    else if (elevated) accessKind = "admin";

    return {
      id: a.id,
      label: a.label,
      username: a.username,
      fromName: a.fromName,
      accessKind,
      ownerName: a.user.name,
      ownerEmail: a.user.email,
    };
  });

  return sortAccessibleAccounts(mapped, userId, elevated);
}

const cachedAccountsForUser = unstable_cache(
  async (userId: string, elevated: boolean) => loadAccessibleAccounts(userId, elevated),
  ["accessible-email-accounts-v6"],
  { revalidate: 120, tags: ["accessible-email-accounts"] }
);

/** Mailboxes the signed-in user may view (own, delegated, or all for CEO admin). */
export async function getAccessibleEmailAccounts(): Promise<AccessibleEmailAccount[]> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const elevated = await isMailboxAdmin(userId);
  return serializeDecimalsList(await cachedAccountsForUser(userId, elevated));
}
