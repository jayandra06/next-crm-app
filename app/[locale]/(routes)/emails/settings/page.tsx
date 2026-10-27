import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, ShieldAlert, Sparkles, Inbox } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { getAccessibleEmailAccounts } from "@/actions/emails/accessible-accounts";
import { getEmailAccounts } from "@/actions/emails/accounts";
import { getFeatureEmailPreferences } from "@/actions/emails/feature-preferences";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Container from "../../components/ui/Container";
import { FeatureEmailPreferencesForm } from "./FeatureEmailPreferencesForm";
import { EmailAccountsList } from "../../profile/components/EmailAccountsList";

interface EmailSettingsPageProps {
  searchParams: Promise<{ feature?: string }>;
}

export default async function EmailSettingsPage({ searchParams }: EmailSettingsPageProps) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { feature } = await searchParams;
  const isAdmin = session.user.role === "admin";

  const [accessibleAccounts, userAccounts, featurePreferences] = await Promise.all([
    getAccessibleEmailAccounts(),
    getEmailAccounts(),
    getFeatureEmailPreferences(),
  ]);

  return (
    <div
      data-emails-settings
      className="flex-1 h-full min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 hover:[&::-webkit-scrollbar-thumb]:bg-border pr-1 sm:pr-2"
    >
      <Container
        title="Email Settings"
        description="Configure your personal mailboxes, manage delegation access, and choose your preferred sender address across CRM features."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2 shadow-xs">
              <Link href="/emails">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Inbox</span>
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="secondary" size="sm" className="gap-2 shadow-xs">
                <Link href="/admin/email-accounts">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">Admin Mailboxes</span>
                </Link>
              </Button>
            )}
          </div>
        }
      >
        <div className="mx-auto max-w-5xl space-y-8 pb-16">
          {/* Feature-specific sender preferences section */}
          <section className="space-y-4">
            <FeatureEmailPreferencesForm
              accounts={accessibleAccounts}
              initialPreferences={featurePreferences}
              highlightedFeature={feature}
            />
          </section>

          <Separator className="my-6 opacity-60" />

          {/* Mailbox Management & Delegation section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Your Connected Mailboxes</h3>
              <p className="text-xs text-muted-foreground">
                Manage your personal email accounts, SMTP relay configuration, and share inbox access with specific teammates.
              </p>
            </div>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/40" />}>
              <EmailAccountsList accounts={userAccounts} />
            </Suspense>
          </section>
        </div>
      </Container>
    </div>
  );
}
