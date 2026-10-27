import Link from "next/link";
import { getEmailAccounts, getDelegatedToMeAccounts } from "@/actions/emails/accounts";
import { EmailAccountsList } from "../EmailAccountsList";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, Server, UserPlus, Users } from "lucide-react";
import { EmailSendProvider } from "@prisma/client";

export async function EmailAccountsTabContent() {
  const [accounts, delegatedToMe] = await Promise.all([
    getEmailAccounts(),
    getDelegatedToMeAccounts(),
  ]);
  const hasActiveMailbox = accounts.some((a) => a.isActive);
  const resendMailbox = accounts.find(
    (a) => a.isActive && a.sendProvider === EmailSendProvider.RESEND
  );

  return (
    <div className="max-w-3xl space-y-4 py-2">
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle>Delegated Email Access</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          You can allow other employees to manage your email section. Click{" "}
          <strong className="text-foreground">Delegate Access</strong> on your mailbox below to add
          colleagues who can view and send emails on your behalf.
        </AlertDescription>
      </Alert>

      <Alert className="border-primary/30 bg-primary/5">
        <Server className="h-4 w-4" />
        <AlertTitle>SMTP for Outlook, Gmail, Thunderbird</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          {resendMailbox ? (
            <>
              You have a mailbox (<strong>{resendMailbox.username}</strong>). Scroll to that card
              and click{" "}
              <strong className="text-foreground">Use in Outlook, Gmail app, etc.</strong> to copy
              SMTP server, port, username, and reveal the password.
            </>
          ) : (
            <>
              You need a <strong>Resend mailbox</strong> on this account first. Ask an admin under{" "}
              <Link href="/admin/email-accounts" className="font-medium text-primary underline-offset-4 hover:underline">
                Administration → Email mailboxes
              </Link>
              , or add one below if your address is on the verified domain.
            </>
          )}
        </AlertDescription>
      </Alert>

      {delegatedToMe.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight">Mailboxes Delegated to You</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            The following colleagues have allowed you to use their email section. You can view their inbox and send messages on their behalf from E-mails in the sidebar.
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {delegatedToMe.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.username} · Owner: {d.ownerName || d.ownerEmail}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                  <Link href={`/emails?accountId=${d.id}`}>
                    <Inbox className="h-3.5 w-3.5" />
                    Open
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Read and send inside the CRM from{" "}
        <Link href="/emails" className="font-medium text-primary underline-offset-4 hover:underline">
          E-mails
        </Link>{" "}
        in the sidebar.
      </p>
      {hasActiveMailbox && (
        <Button asChild className="gap-2">
          <Link href="/emails">
            <Inbox className="h-4 w-4" />
            Open inbox
          </Link>
        </Button>
      )}
      <EmailAccountsList accounts={accounts} />
    </div>
  );
}
