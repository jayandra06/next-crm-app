"use server";

import { after } from "next/server";
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

  // Pull new mail after the response. Waiting on Resend here held the inbox
  // blank for the whole API round-trip on every first page load.
  if (view === "inbox" && page === 1 && !search) {
    after(async () => {
      try {
        const account = await prismadb.emailAccount.findUnique({
          where: { id: accountId },
          select: { lastSyncedAt: true },
        });
        const lastSyncMs = account?.lastSyncedAt?.getTime() ?? 0;
        if (Date.now() - lastSyncMs > 60_000) {
          await syncResendInbound(accountId);
        }
      } catch (err) {
        console.warn("[mailbox-page] Inbound auto-sync error:", err);
      }
    });
  }

  const [emails, counts] = await Promise.all([
    getMailboxEmails(accountId, viewRaw, page, search, unreadOnly),
    getMailboxCounts(accountId),
  ]);
  return { emails, counts };
}
