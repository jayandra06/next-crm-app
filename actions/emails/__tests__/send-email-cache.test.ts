import { sendEmail } from "@/actions/emails/messages";
import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { invalidateMailboxCache } from "@/lib/email/mailbox-cache";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { EmailFolder, EmailSendProvider } from "@prisma/client";

jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    emailAccount: {
      findUnique: jest.fn(),
    },
    email: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/email-crypto", () => ({
  decrypt: jest.fn(() => "mock-password"),
}));

jest.mock("@/lib/net/host-guard", () => ({
  assertPublicHost: jest.fn().mockResolvedValue({
    address: "93.184.216.34",
    hostname: "smtp.example.com",
  }),
  HostNotAllowedError: class HostNotAllowedError extends Error {},
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: "<smtp-msg-123@example.com>" }),
    })),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/email/mailbox-cache", () => ({
  invalidateMailboxCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({ ids: ["evt-1"] }),
  },
}));

describe("sendEmail cache invalidation & immediate reflection", () => {
  const mockGetSession = getSession as jest.Mock;
  const mockFindUnique = prismadb.emailAccount.findUnique as jest.Mock;
  const mockCreate = prismadb.email.create as jest.Mock;
  const mockInvalidate = invalidateMailboxCache as jest.Mock;
  const mockRevalidatePath = revalidatePath as jest.Mock;
  const mockInngestSend = inngest.send as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123" },
    });
  });

  it("invalidates mailbox cache, calls revalidatePath, and returns created email immediately", async () => {
    const mockAccount = {
      id: "acc-456",
      userId: "user-123",
      username: "user@vensailabs.in",
      fromName: "Akhil Kumar",
      label: "Work Mail",
      sendProvider: EmailSendProvider.SMTP,
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSsl: true,
      allowSelfSignedTls: false,
      passwordEncrypted: "encrypted-pw",
      delegateUserIds: ["delegate-789"],
      isActive: true,
    };

    mockFindUnique.mockResolvedValue(mockAccount);

    const mockSavedEmail = {
      id: "email-new-1",
      emailAccountId: "acc-456",
      userId: "user-123",
      rfcMessageId: "<smtp-msg-123@example.com>",
      folder: EmailFolder.SENT,
      subject: "Test Immediate Sent",
      fromName: "Akhil Kumar",
      fromEmail: "user@vensailabs.in",
      toRecipients: [{ email: "client@example.com" }],
      ccRecipients: [],
      bccRecipients: [],
      bodyText: "Hello there!",
      bodyHtml: "<p>Hello there!</p>",
      attachments: [],
      sentAt: new Date("2026-10-24T12:00:00Z"),
      isRead: true,
      isSpam: false,
      isArchived: false,
      isStarred: false,
    };

    mockCreate.mockResolvedValue(mockSavedEmail);

    const result = await sendEmail({
      accountId: "acc-456",
      to: ["client@example.com"],
      subject: "Test Immediate Sent",
      body: "Hello there!",
      bodyHtml: "<p>Hello there!</p>",
    });

    // 1. Check DB insertion
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailAccountId: "acc-456",
          userId: "user-123",
          folder: EmailFolder.SENT,
          subject: "Test Immediate Sent",
          fromName: "Akhil Kumar",
          fromEmail: "user@vensailabs.in",
          bodyText: "Hello there!",
          isRead: true,
        }),
      })
    );

    // 2. Check cache invalidation for session user, owner, and delegates
    expect(mockInvalidate).toHaveBeenCalledWith("user-123", "acc-456");
    expect(mockInvalidate).toHaveBeenCalledWith("delegate-789", "acc-456");

    // 3. Check Next.js revalidatePath
    expect(mockRevalidatePath).toHaveBeenCalledWith("/[locale]/(routes)/emails", "page");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/emails");

    // 4. Check CRM linking inngest event
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "email/link-crm",
      data: { emailId: "email-new-1" },
    });

    // 5. Check immediate return value
    expect(result).toBeDefined();
    expect(result.id).toBe("email-new-1");
    expect(result.folder).toBe(EmailFolder.SENT);
    expect(result.subject).toBe("Test Immediate Sent");
  });
});
