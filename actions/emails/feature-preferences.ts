"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { getAccessibleEmailAccounts } from "@/actions/emails/accessible-accounts";
import {
  type FeatureKey,
  type FeatureMeta,
  PREF_COOKIE_PREFIX,
} from "@/lib/email/feature-preferences";

export type { FeatureKey, FeatureMeta };

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
