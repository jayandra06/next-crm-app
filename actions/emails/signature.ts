"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { AuthorizationError, requireAuthenticated, requireRole } from "@/lib/authz";

function refreshMailboxes() {
  revalidateTag("accessible-email-accounts", "max");
  revalidatePath("/emails");
  revalidatePath("/profile");
  revalidatePath("/admin/email-accounts");
}

async function mailboxForSignatureEdit(accountId: string) {
  const actor = await requireAuthenticated();
  const account = await prismadb.emailAccount.findUnique({
    where: { id: accountId },
    select: { id: true, userId: true },
  });
  if (!account) throw new Error("Mailbox not found");
  if (account.userId === actor.id) return account;
  try {
    await requireRole(["admin"]);
    return account;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new Error("You can edit the signature on a mailbox you own. An admin can edit any mailbox.");
    }
    throw error;
  }
}

export async function saveMailboxSignature(
  accountId: string,
  input: { text: string; imageUrl: string | null }
) {
  const account = await mailboxForSignatureEdit(accountId);
  const text = input.text.replace(/\r\n/g, "\n").trim();
  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    throw new Error("Signature image must be an uploaded https file");
  }
  if (text.length > 800) throw new Error("Signature text is too long");

  await prismadb.emailAccount.update({
    where: { id: account.id },
    data: {
      signatureText: text || null,
      signatureImageUrl: imageUrl,
    },
  });
  refreshMailboxes();
}
