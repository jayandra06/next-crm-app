import Container from "../../components/ui/Container";
import { EmailAccountsList } from "../../profile/components/EmailAccountsList";
import {
  getAdminEmailAccounts,
  getUsersForEmailAccountAssignment,
} from "@/actions/admin/email-accounts";
import { EmailMailboxStats } from "./EmailMailboxStats";
import { EmailEnvConfigPanel } from "./EmailEnvConfigPanel";
import { DelegateSettings } from "../../profile/components/DelegateSettings";

export default async function AdminEmailAccountsPage() {
  const [accounts, users] = await Promise.all([
    getAdminEmailAccounts(),
    getUsersForEmailAccountAssignment(),
  ]);

  return (
    <Container
      title="Email mailboxes"
      description="Create team mailboxes here. Users read and send mail under E-mails in the sidebar (/emails)."
    >
      <div className="mx-auto max-w-4xl space-y-8 pb-8">
        <EmailMailboxStats accounts={accounts} />
        <EmailEnvConfigPanel />
        <DelegateSettings mode="admin" />
        <EmailAccountsList accounts={accounts} admin assignableUsers={users} />
      </div>
    </Container>
  );
}
