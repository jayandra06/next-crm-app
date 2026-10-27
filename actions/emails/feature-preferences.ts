"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { getAccessibleEmailAccounts } from "@/actions/emails/accessible-accounts";

export type FeatureKey =
  | "emails"
  | "marketing"
  | "sales"
  | "leads"
  | "contacts"
  | "contracts"
  | "canva"
  | "linkedin";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
  iconName: string;
  defaultPath: string;
}

export const SUPPORTED_FEATURES: FeatureMeta[] = [
  {
    key: "emails",
    label: "E-mails",
    description: "Primary mailbox used for reading, composing, and replying in the Email module.",
    iconName: "Mail",
    defaultPath: "/emails",
  },
  {
    key: "leads",
    label: "Leads",
    description: "Default mailbox used for single and bulk email outreach to new leads.",
    iconName: "UserCheck",
    defaultPath: "/crm/leads",
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Default sender mailbox for direct client communication and follow-ups.",
    iconName: "Users",
    defaultPath: "/crm/contacts",
  },
  {
    key: "sales",
    label: "Sales & Opportunities",
    description: "Mailbox used when sending deal proposals, quotes, and opportunity updates.",
    iconName: "TrendingUp",
    defaultPath: "/crm/opportunities",
  },
  {
    key: "contracts",
    label: "Contracts",
    description: "Mailbox used for contract delivery, legal agreements, and signing requests.",
    iconName: "FileCheck",
    defaultPath: "/crm/contracts",
  },
  {
    key: "marketing",
    label: "Email Marketing & Campaigns",
    description: "Default sender mailbox for email campaigns, broadcasts, and audience templates.",
    iconName: "Megaphone",
    defaultPath: "/campaigns",
  },
  {
    key: "canva",
    label: "Canva Integration",
    description: "Sender mailbox associated with Canva design sharing and asset approval notifications.",
    iconName: "Palette",
    defaultPath: "/admin/canva",
  },
  {
    key: "linkedin",
    label: "LinkedIn Integration",
    description: "Mailbox used for LinkedIn lead notifications and outreach synchronizations.",
    iconName: "Linkedin",
    defaultPath: "/admin/linkedin",
  },
];

const PREF_COOKIE_PREFIX = "crm_email_pref_";

/** Get all feature-specific email preferences for the authenticated user */
export async function getFeatureEmailPreferences(): Promise<Record<FeatureKey, string>> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return {} as Record<FeatureKey, string>;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(`${PREF_COOKIE_PREFIX}${userId}`)?.value;
  if (!raw) {
    return {} as Record<FeatureKey, string>;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<FeatureKey, string>;
    }
  } catch {
    // Malformed JSON cookie, return empty
  }

  return {} as Record<FeatureKey, string>;
}

/** Set the preferred sender email account for a specific CRM feature */
export async function setFeatureEmailPreference(
  feature: FeatureKey,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate that the user actually has access to this account
  const accounts = await getAccessibleEmailAccounts();
  const hasAccess = accounts.some((a) => a.id === accountId);
  if (!hasAccess && accountId !== "") {
    return { success: false, error: "You do not have access to this email account" };
  }

  const currentPrefs = await getFeatureEmailPreferences();
  const updatedPrefs: Record<string, string> = {
    ...currentPrefs,
    [feature]: accountId,
  };

  const cookieStore = await cookies();
  cookieStore.set(`${PREF_COOKIE_PREFIX}${userId}`, JSON.stringify(updatedPrefs), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  revalidatePath("/emails/settings");
  revalidatePath("/emails");
  return { success: true };
}

/** Get the resolved email account ID to use for a feature */
export async function getPreferredAccountIdForFeature(
  feature: FeatureKey
): Promise<string | null> {
  const [prefs, accounts] = await Promise.all([
    getFeatureEmailPreferences(),
    getAccessibleEmailAccounts(),
  ]);

  if (accounts.length === 0) return null;

  const preferredId = prefs[feature];
  if (preferredId && accounts.some((a) => a.id === preferredId)) {
    return preferredId;
  }

  // Fallback to default emails preference, or the first active mailbox
  const defaultEmailId = prefs.emails;
  if (defaultEmailId && accounts.some((a) => a.id === defaultEmailId)) {
    return defaultEmailId;
  }

  return accounts[0]?.id ?? null;
}
