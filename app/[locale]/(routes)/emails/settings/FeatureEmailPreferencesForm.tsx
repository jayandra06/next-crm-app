"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  UserCheck,
  Users,
  TrendingUp,
  FileCheck,
  Megaphone,
  Palette,
  Linkedin,
  CheckCircle2,
  Sliders,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setFeatureEmailPreference } from "@/actions/emails/feature-preferences";
import {
  SUPPORTED_FEATURES,
  type FeatureKey,
} from "@/lib/email/feature-preferences";
import type { AccessibleEmailAccount } from "@/actions/emails/accessible-accounts";

interface FeatureEmailPreferencesFormProps {
  accounts: AccessibleEmailAccount[];
  initialPreferences: Record<FeatureKey, string>;
  highlightedFeature?: string;
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  Mail,
  UserCheck,
  Users,
  TrendingUp,
  FileCheck,
  Megaphone,
  Palette,
  Linkedin,
};

export function FeatureEmailPreferencesForm({
  accounts,
  initialPreferences,
  highlightedFeature,
}: FeatureEmailPreferencesFormProps) {
  const [preferences, setPreferences] = useState<Record<FeatureKey, string>>(initialPreferences);
  const [savingFeature, setSavingFeature] = useState<FeatureKey | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handlePreferenceChange(feature: FeatureKey, accountId: string) {
    setSavingFeature(feature);
    const prev = preferences[feature];
    setPreferences((current) => ({ ...current, [feature]: accountId }));

    startTransition(async () => {
      try {
        const res = await setFeatureEmailPreference(feature, accountId);
        if (!res.success) {
          setPreferences((current) => ({ ...current, [feature]: prev }));
          toast.error(res.error || "Failed to update email sender preference");
        } else {
          const selectedAccount = accounts.find((a) => a.id === accountId);
          toast.success(
            `Default sender for ${feature.toUpperCase()} updated${
              selectedAccount ? ` to ${selectedAccount.username}` : ""
            }`
          );
        }
      } catch (err: any) {
        setPreferences((current) => ({ ...current, [feature]: prev }));
        toast.error(err?.message || "Error saving preference");
      } finally {
        setSavingFeature(null);
      }
    });
  }

  if (accounts.length === 0) {
    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Mail className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No email mailboxes connected</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Connect an email account below to configure feature-specific email preferences for Leads,
            Contacts, Sales, Marketing, Canva, and LinkedIn.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Feature Sender Preferences</h3>
          <p className="text-xs text-muted-foreground">
            Choose which mailbox address should be used as the default sender for each module.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-[11px] font-normal">
          <Sliders className="h-3 w-3" />
          {SUPPORTED_FEATURES.length} features configurable
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {SUPPORTED_FEATURES.map((feature) => {
          const Icon = FEATURE_ICONS[feature.iconName] || Mail;
          const isHighlighted = highlightedFeature === feature.key;
          const currentAccountId = preferences[feature.key] || accounts[0]?.id || "";
          const activeAccount = accounts.find((a) => a.id === currentAccountId) || accounts[0];
          const isSaving = savingFeature === feature.key && isPending;

          return (
            <Card
              key={feature.key}
              className={cn(
                "relative overflow-hidden transition-all",
                isHighlighted
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                  : "hover:border-border/80"
              )}
            >
              {isHighlighted && (
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" />
                  Active feature
                </div>
              )}
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary",
                      isHighlighted ? "bg-primary text-primary-foreground" : "bg-primary/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold truncate">
                      {feature.label}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sender Mailbox
                  </label>
                  <Select
                    value={currentAccountId}
                    onValueChange={(val) => handlePreferenceChange(feature.key, val)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="h-9 w-full text-xs font-medium">
                      <SelectValue placeholder="Select email account">
                        {activeAccount ? (
                          <span className="truncate">
                            {activeAccount.label || activeAccount.username}{" "}
                            <span className="text-muted-foreground">({activeAccount.username})</span>
                          </span>
                        ) : (
                          "Select mailbox"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start" className="max-w-[22rem]">
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium">{acc.label || acc.username}</span>
                            <span className="text-muted-foreground text-[11px]">({acc.username})</span>
                            {acc.accessKind !== "owner" && (
                              <Badge variant="secondary" className="ml-1 text-[9px] uppercase px-1 py-0">
                                {acc.accessKind}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
