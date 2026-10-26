import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getMailboxPageData } from "@/actions/emails/mailbox-page";
import { syncResendInbound } from "@/lib/email/resend-inbound";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const accountId = sp.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const view = sp.get("view") ?? sp.get("box") ?? undefined;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const search = sp.get("search") ?? undefined;
  const unreadOnly = sp.get("filter") === "unread";
  const shouldSync = sp.get("sync") === "1" || sp.get("sync") === "true";

  if (shouldSync) {
    try {
      await syncResendInbound(accountId);
    } catch (syncErr) {
      console.warn("[mailbox-api] Background Resend sync skipped/failed:", syncErr);
    }
  }

  try {
    const data = await getMailboxPageData(accountId, view, page, search, unreadOnly);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load mailbox" }, { status: 500 });
  }
}
