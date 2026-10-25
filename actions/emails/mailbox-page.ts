"use server";

import { getMailboxCounts, getMailboxEmails } from "@/actions/emails/mailbox-actions";
import type { MailboxCounts } from "@/lib/email/mailbox-types";
import type { MailboxEmailsResult } from "@/lib/email/mailbox-types";
import { parseMailboxView } from "@/lib/email/mailbox-views";
import { prismadb } from "@/lib/prisma";
import { syncResendInbound } from "@/lib/email/resend-inbound";

/** One round-trip for the emails route: list + folder counts. */
export async function getMailboxPageData(
  accountId: string,
  viewRaw: string | undefined,
  page: number,
  search?: string,
  unreadOnly?: boolean
): Promise<{ emails: MailboxEmailsResult; counts: MailboxCounts }> {
  const view = parseMailboxView(viewRaw);

  // Auto-sync incoming mail on inbox view if not synced in the last 60 seconds
  if (view === "inbox" && page === 1 && !search) {
    try {
      const account = await prismadb.emailAccount.findUnique({
        where: { id: accountId },
        select: { lastSyncedAt: true },
      });
      const now = Date.now();
      const lastSyncMs = account?.lastSyncedAt?.getTime() ?? 0;
      if (now - lastSyncMs > 60_000) {
        await syncResendInbound(accountId);
      }
    } catch (err) {
      console.warn("[mailbox-page] Inbound auto-sync error:", err);
    }
  }

  const [emails, counts] = await Promise.all([
    getMailboxEmails(accountId, viewRaw, page, search, unreadOnly),
    getMailboxCounts(accountId),
  ]);
  return { emails, counts };
}
