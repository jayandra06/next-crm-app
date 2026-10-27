import { EmailFolder, EmailSendProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { getResendApiKey } from "@/lib/resend";
import { inngest } from "@/inngest/client";
import { invalidateMailboxCache } from "@/lib/email/mailbox-cache";
import { revalidatePath } from "next/cache";

export type ResendReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  created_at?: string;
  message_id?: string | null;
  received_for?: string[];
};

export function normalizeEmailAddress(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle?.[1] ?? trimmed).toLowerCase();
}

export function parseFromField(from?: string | null): { fromName: string | null; fromEmail: string | null } {
  if (!from || typeof from !== "string") {
    return { fromName: null, fromEmail: null };
  }
  const trimmed = from.trim();
  const angle = trimmed.match(/^(.*?)<\s*([^>]+)\s*>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return { fromName: name || null, fromEmail: angle[2].trim() };
  }
  if (trimmed.includes("@")) {
    return { fromName: null, fromEmail: trimmed };
  }
  return { fromName: trimmed || null, fromEmail: null };
}

export function toRecipientJson(addresses: string[] | undefined) {
  return (addresses ?? []).map((addr) => {
    const email = normalizeEmailAddress(addr);
    const parsed = parseFromField(addr);
    return { email: parsed.fromEmail ?? email, name: parsed.fromName ?? undefined };
  });
}

export async function fetchResendReceivedEmail(emailId: string): Promise<ResendReceivedEmail> {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it in Vercel Environment Variables or .env.local."
    );
  }
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend receiving API ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as ResendReceivedEmail & { id?: string };
  return { ...json, id: json.id ?? emailId };
}

/** All addresses this inbound message was delivered to (Resend To + received_for). */
export function collectInboundRecipientAddresses(
  payload: ResendReceivedEmail,
  webhookMeta?: {
    to?: string[];
    received_for?: string[];
    cc?: string[];
    bcc?: string[];
  }
): string[] {
  const set = new Set<string>();
  for (const list of [
    payload.received_for,
    webhookMeta?.received_for,
    payload.to,
    webhookMeta?.to,
    payload.cc,
    webhookMeta?.cc,
    payload.bcc,
    webhookMeta?.bcc,
  ]) {
    for (const addr of list ?? []) {
      set.add(normalizeEmailAddress(addr));
    }
  }
  return Array.from(set);
}

type ResendMailboxMatch = {
  id: string;
  userId: string;
  username: string;
  matchedAddress: string;
};

/**
 * Map inbound recipients to CRM mailboxes. Each employee mailbox uses
 * EmailAccount.username = work email (e.g. dhoni@vensailabs.in).
 */
export async function findResendMailboxesForRecipients(
  recipientAddresses: string[]
): Promise<ResendMailboxMatch[]> {
  if (recipientAddresses.length === 0) return [];

  const wantedList = Array.from(new Set(recipientAddresses.map((r) => normalizeEmailAddress(r)).filter(Boolean)));
  const wanted = new Set(wantedList);
  const accountSelect = {
    id: true,
    userId: true,
    username: true,
    user: { select: { workEmail: true, email: true } },
  } as const;

  // Match only the addresses on this message. Loading every mailbox made
  // inbound slower each time a new mailbox was created.
  let accounts = await prismadb.emailAccount.findMany({
    where: {
      isActive: true,
      OR: [
        { username: { in: wantedList, mode: "insensitive" } },
        { user: { workEmail: { in: wantedList, mode: "insensitive" } } },
        { user: { email: { in: wantedList, mode: "insensitive" } } },
      ],
    },
    select: accountSelect,
  });

  if (accounts.length === 0 && wantedList.some((addr) => addr.endsWith("@vensailabs.in"))) {
    accounts = await prismadb.emailAccount.findMany({
      where: {
        isActive: true,
        OR: [
          { username: { startsWith: "ceo@", mode: "insensitive" } },
          { username: { startsWith: "admin@", mode: "insensitive" } },
        ],
      },
      select: accountSelect,
      take: 5,
    });
    if (accounts.length === 0) {
      const anyAccount = await prismadb.emailAccount.findFirst({
        where: { isActive: true },
        select: accountSelect,
        orderBy: { createdAt: "asc" },
      });
      accounts = anyAccount ? [anyAccount] : [];
    }
  }

  const matches: ResendMailboxMatch[] = [];
  const seenAccountIds = new Set<string>();

  for (const account of accounts) {
    const mailboxAddresses = [
      normalizeEmailAddress(account.username),
      account.user?.workEmail ? normalizeEmailAddress(account.user.workEmail) : null,
      account.user?.email ? normalizeEmailAddress(account.user.email) : null,
    ].filter(Boolean) as string[];

    for (const addr of mailboxAddresses) {
      if (wanted.has(addr) && !seenAccountIds.has(account.id)) {
        seenAccountIds.add(account.id);
        matches.push({
          id: account.id,
          userId: account.userId,
          username: account.username,
          matchedAddress: addr,
        });
        break;
      }
    }
  }

  // Fallback: If no direct recipient matched, but at least one recipient address is on vensailabs.in
  // or company domain, route to the primary admin/CEO mailbox so the message is never dropped.
  if (matches.length === 0 && accounts.length > 0) {
    const hasCompanyDomainRecipient = Array.from(wanted).some((addr) =>
      addr.endsWith("@vensailabs.in")
    );
    if (hasCompanyDomainRecipient) {
      const fallbackAccount =
        accounts.find((a) =>
          a.username.toLowerCase().startsWith("ceo@") ||
          a.username.toLowerCase().startsWith("admin@")
        ) || accounts[0];
      if (fallbackAccount) {
        matches.push({
          id: fallbackAccount.id,
          userId: fallbackAccount.userId,
          username: fallbackAccount.username,
          matchedAddress: fallbackAccount.username,
        });
      }
    }
  }

  return matches;
}

async function storeInboundForMailbox(
  payload: ResendReceivedEmail,
  account: ResendMailboxMatch
): Promise<{ stored: boolean; emailId?: string; reason?: string }> {
  const rfcMessageId = (
    payload.message_id?.trim() || `resend-inbound-${payload.id}`
  ).replace(/^<|>$/g, "");
  const { fromName, fromEmail } = parseFromField(payload.from);
  const sentAt = payload.created_at ? new Date(payload.created_at) : new Date();

  const existing = await prismadb.email.findUnique({
    where: {
      emailAccountId_rfcMessageId: {
        emailAccountId: account.id,
        rfcMessageId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prismadb.emailAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });
    return { stored: false, reason: "duplicate", emailId: existing.id };
  }

  const created = await prismadb.email.create({
    data: {
      emailAccountId: account.id,
      userId: account.userId,
      rfcMessageId,
      folder: EmailFolder.INBOX,
      subject: payload.subject ?? null,
      fromName,
      fromEmail,
      toRecipients: toRecipientJson(payload.to),
      ccRecipients: toRecipientJson(payload.cc),
      bccRecipients: toRecipientJson(payload.bcc),
      bodyText: payload.text ?? null,
      bodyHtml: payload.html ?? null,
      attachments: [],
      sentAt,
      isRead: false,
    },
    select: { id: true },
  });

  await prismadb.emailAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  const fullAccount = await prismadb.emailAccount.findUnique({
    where: { id: account.id },
    select: { delegateUserIds: true },
  });
  const userIds = new Set<string>([account.userId, ...(fullAccount?.delegateUserIds ?? [])]);
  await Promise.all(Array.from(userIds).map((uid) => invalidateMailboxCache(uid, account.id)));

  revalidatePath("/[locale]/(routes)/emails", "page");
  revalidatePath("/emails");

  await inngest.send({ name: "email/link-crm", data: { emailId: created.id } }).catch(() => {});
  void inngest
    .send({
      name: "email/resend-attachments",
      data: { emailId: created.id, resendEmailId: payload.id },
    })
    .catch(() => {});

  return { stored: true, emailId: created.id };
}

/** Ingest one Resend inbound message into every matching employee inbox. */
export async function ingestResendInboundEmail(
  resendEmailId: string,
  webhookMeta?: { to?: string[]; cc?: string[]; bcc?: string[]; received_for?: string[] }
) {
  const payload = await fetchResendReceivedEmail(resendEmailId);
  const recipients = collectInboundRecipientAddresses(payload, webhookMeta);
  const mailboxes = await findResendMailboxesForRecipients(recipients);

  if (mailboxes.length === 0) {
    console.warn("[resend-inbound] No mailbox for recipients:", recipients);
    return {
      stored: false,
      reason: "no_matching_mailbox" as const,
      recipients,
    };
  }

  const results: Array<{
    accountId: string;
    mailbox: string;
    stored: boolean;
    emailId?: string;
  }> = [];

  for (const mailbox of mailboxes) {
    const result = await storeInboundForMailbox(payload, mailbox);
    results.push({
      accountId: mailbox.id,
      mailbox: mailbox.matchedAddress,
      stored: result.stored,
      emailId: result.emailId,
    });
  }

  return {
    stored: results.some((r) => r.stored),
    mailboxes: results,
    recipients,
  };
}

export function getResendInboundWebhookUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/webhooks/resend/inbound`;
}

/**
 * Polling / on-demand sync for Resend inbound emails:
 * Fetches recent received messages from Resend API (GET /emails/receiving),
 * checks for any that are missing from PostgreSQL, and ingests them.
 */
export async function syncResendInbound(
  targetAccountId?: string
): Promise<{ synced: number; newMessages: number }> {
  const apiKey = await getResendApiKey();
  if (!apiKey) return { synced: 0, newMessages: 0 };

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails/receiving", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[resend-inbound] Failed to connect to Resend receiving API:", err);
    return { synced: 0, newMessages: 0 };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[resend-inbound] List receiving emails failed:", res.status, errText);
    return { synced: 0, newMessages: 0 };
  }

  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      to?: string[];
      from?: string;
      subject?: string | null;
      created_at?: string;
      message_id?: string | null;
      cc?: string[];
      bcc?: string[];
      received_for?: string[];
    }>;
  };

  const items = json.data ?? [];
  if (items.length === 0) return { synced: 0, newMessages: 0 };

  const rfcIdsToCheck = items.flatMap((item) => {
    const ids: string[] = [`resend-inbound-${item.id}`];
    if (item.message_id?.trim()) {
      ids.push(item.message_id.trim().replace(/^<|>$/g, ""));
    }
    return ids;
  });

  const existingEmails = await prismadb.email.findMany({
    where: {
      ...(targetAccountId ? { emailAccountId: targetAccountId } : {}),
      rfcMessageId: { in: rfcIdsToCheck },
    },
    select: { rfcMessageId: true, emailAccountId: true },
  });

  const existingSet = new Set(
    existingEmails.map((e) => `${e.emailAccountId}:${e.rfcMessageId}`)
  );

  let newMessagesCount = 0;
  const mailboxCache = new Map<string, ResendMailboxMatch[]>();

  for (const item of items) {
    const cleanRfc = (item.message_id?.trim() || `resend-inbound-${item.id}`).replace(/^<|>$/g, "");
    const fallbackRfc = `resend-inbound-${item.id}`;
    if (
      targetAccountId &&
      (existingSet.has(`${targetAccountId}:${cleanRfc}`) ||
        existingSet.has(`${targetAccountId}:${fallbackRfc}`))
    ) {
      continue;
    }

    const addresses = collectInboundRecipientAddresses({
      id: item.id,
      from: item.from ?? "",
      to: item.to ?? [],
      cc: item.cc,
      bcc: item.bcc,
      received_for: item.received_for,
    });
    const cacheKey = [...addresses].sort().join("|");
    let mailboxes = mailboxCache.get(cacheKey);
    if (!mailboxes) {
      mailboxes = await findResendMailboxesForRecipients(addresses);
      mailboxCache.set(cacheKey, mailboxes);
    }

    if (!targetAccountId && mailboxes.length === 0) continue;

    const alreadyStored = !targetAccountId && mailboxes.every(
      (mailbox) =>
        existingSet.has(`${mailbox.id}:${cleanRfc}`) ||
        existingSet.has(`${mailbox.id}:${fallbackRfc}`)
    );
    if (alreadyStored) continue;

    try {
      const result = await ingestResendInboundEmail(item.id, {
        to: item.to,
        cc: item.cc,
        bcc: item.bcc,
        received_for: item.received_for,
      });
      if (result.stored) {
        newMessagesCount++;
      }
    } catch (err) {
      console.error(`[resend-inbound] Failed to ingest email ${item.id}:`, err);
    }
  }

  return { synced: items.length, newMessages: newMessagesCount };
}
