"use server";

import { resolveMailboxAccess } from "@/lib/email/mailbox-access";
import { prismadb } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { syncResendInbound } from "@/lib/email/resend-inbound";
import { invalidateMailboxCache } from "@/lib/email/mailbox-cache";
import { revalidatePath } from "next/cache";

export async function syncMailboxAction(accountId: string): Promise<{
  success: boolean;
  newMessages: number;
}> {
  await resolveMailboxAccess(accountId);

  const account = await prismadb.emailAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      userId: true,
      delegateUserIds: true,
      passwordEncrypted: true,
      sendProvider: true,
    },
  });

  if (!account) throw new Error("Account not found");

  // 1. Fetch & ingest any pending inbound emails via Resend API
  let newMessages = 0;
  try {
    const resendResult = await syncResendInbound(accountId);
    newMessages += resendResult.newMessages;
  } catch (err) {
    console.warn(`[sync-action] Resend sync error for account ${accountId}:`, err);
  }

  // 2. If IMAP credentials exist, also trigger background IMAP sync
  if (account.passwordEncrypted) {
    try {
      await inngest.send({ name: "email/sync-account", data: { accountId } });
    } catch (err) {
      console.warn(`[sync-action] Inngest queue error for account ${accountId}:`, err);
    }
  }

  // 3. Invalidate Redis mailbox caches for the owner and any delegates
  const userIds = new Set<string>([account.userId, ...(account.delegateUserIds ?? [])]);
  await Promise.all(Array.from(userIds).map((uid) => invalidateMailboxCache(uid, account.id)));

  // 4. Invalidate Next.js cache so the server component refreshes
  revalidatePath("/[locale]/(routes)/emails", "page");
  revalidatePath("/emails");

  return { success: true, newMessages };
}

/** Backward compatibility alias */
export const triggerSync = syncMailboxAction;
