import { inngest } from "@/inngest/client";
import { prismadb } from "@/lib/prisma";
import { syncResendInbound } from "@/lib/email/resend-inbound";

export const emailSyncAll = inngest.createFunction(
  {
    id: "email-sync-all",
    name: "Email: Sync All Accounts",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    // 1. Sync any new inbound emails directly from Resend
    let resendResult = { synced: 0, newMessages: 0 };
    try {
      resendResult = await step.run("sync-resend-inbound", () => syncResendInbound());
    } catch (err) {
      console.warn("[email-sync-all] Failed to sync Resend inbound emails:", err);
    }

    // 2. Fetch all active accounts with credentials for IMAP sync
    const accounts = await step.run("fetch-active-accounts", () =>
      prismadb.emailAccount.findMany({
        where: { isActive: true },
        select: { id: true, passwordEncrypted: true },
      })
    );

    const imapAccounts = accounts.filter((a) => !!a.passwordEncrypted);

    if (imapAccounts.length > 0) {
      await inngest.send(
        imapAccounts.map((a) => ({
          name: "email/sync-account" as const,
          data: { accountId: a.id },
        }))
      );
    }

    return {
      syncedAccounts: accounts.length,
      imapAccounts: imapAccounts.length,
      resendNewMessages: resendResult.newMessages,
    };
  }
);
