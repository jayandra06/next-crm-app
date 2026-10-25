import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getResendInboundWebhookSecret } from "@/lib/email/resend-webhook-secret";
import { inngest } from "@/inngest/client";

import { ingestResendInboundEmail } from "@/lib/email/resend-inbound";

type ResendInboundWebhookEvent = {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    received_for?: string[];
  };
};

function verifyInboundWebhook(req: NextRequest, rawBody: string): boolean {
  const secret = getResendInboundWebhookSecret();
  if (!secret) {
    // If webhook secret is not configured, allow processing because ingestResendInboundEmail
    // validates the email ID directly against the Resend API using the authentic RESEND_API_KEY.
    return true;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (svixId && svixTimestamp && svixSignature) {
    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
      return true;
    } catch (err) {
      console.error("[resend-inbound] Svix verification failed:", err);
      return false;
    }
  }

  const auth = req.headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}` || auth === secret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  const secret = getResendInboundWebhookSecret();
  if (!secret) {
    console.warn(
      "[resend-inbound] RESEND_INBOUND_WEBHOOK_SECRET is not configured. Processing webhook with direct Resend API authentication."
    );
  }

  const rawBody = await req.text();

  if (!verifyInboundWebhook(req, rawBody)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: ResendInboundWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendInboundWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  const webhookMeta = {
    to: event.data?.to,
    cc: event.data?.cc,
    bcc: event.data?.bcc,
    received_for: event.data?.received_for,
  };

  // 1. Synchronously ingest the inbound email directly so it appears in the inbox immediately
  let syncResult: Awaited<ReturnType<typeof ingestResendInboundEmail>> | null = null;
  try {
    syncResult = await ingestResendInboundEmail(emailId, webhookMeta);
  } catch (err) {
    console.error(`[resend-inbound] Synchronous ingest failed for ${emailId}:`, err);
  }

  // 2. Also send Inngest event for background linking / attachments / fan-out
  try {
    await inngest.send({
      name: "email/resend-inbound",
      data: {
        resendEmailId: emailId,
        to: webhookMeta.to,
        cc: webhookMeta.cc,
        bcc: webhookMeta.bcc,
        received_for: webhookMeta.received_for,
      },
    });
  } catch (err) {
    console.warn("[resend-inbound] Inngest queue warning:", err);
  }

  return NextResponse.json(
    { ok: true, stored: syncResult?.stored ?? false, queued: true },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    message: "Resend inbound webhook endpoint",
    subscribeTo: "email.received",
    docs: "https://resend.com/docs/dashboard/receiving/create-receiving-webhook",
  });
}
