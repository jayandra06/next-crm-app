import {
  findResendMailboxesForRecipients,
  syncResendInbound,
  normalizeEmailAddress,
} from "@/lib/email/resend-inbound";
import { prismadb } from "@/lib/prisma";
import { getResendApiKey } from "@/lib/resend";
import * as resendInboundMod from "@/lib/email/resend-inbound";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    emailAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    email: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/resend", () => ({
  getResendApiKey: jest.fn(),
}));

jest.mock("@/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("@/lib/email/mailbox-cache", () => ({
  invalidateMailboxCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("normalizeEmailAddress", () => {
  it("extracts and lowercases email from angle brackets or plain string", () => {
    expect(normalizeEmailAddress("John Doe <John@VensaiLabs.in>")).toBe("john@vensailabs.in");
    expect(normalizeEmailAddress("  ADMIN@VensaiLabs.IN  ")).toBe("admin@vensailabs.in");
  });
});

describe("findResendMailboxesForRecipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("matches mailbox by account username", async () => {
    (prismadb.emailAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: "acc-1",
        userId: "user-1",
        username: "dhoni@vensailabs.in",
        user: { workEmail: null, email: "dhoni.personal@gmail.com" },
      },
    ]);

    const matches = await findResendMailboxesForRecipients(["dhoni@vensailabs.in"]);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("acc-1");
  });

  it("matches mailbox by user.workEmail and user.email", async () => {
    (prismadb.emailAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: "acc-2",
        userId: "user-2",
        username: "sales@vensailabs.in",
        user: { workEmail: "lead.sales@vensailabs.in", email: "sales.user@company.com" },
      },
    ]);

    const matchesWork = await findResendMailboxesForRecipients(["lead.sales@vensailabs.in"]);
    expect(matchesWork).toHaveLength(1);
    expect(matchesWork[0].id).toBe("acc-2");

    const matchesEmail = await findResendMailboxesForRecipients(["sales.user@company.com"]);
    expect(matchesEmail).toHaveLength(1);
    expect(matchesEmail[0].id).toBe("acc-2");
  });

  it("falls back to admin/ceo account for unknown vensailabs.in recipient", async () => {
    (prismadb.emailAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: "acc-admin",
        userId: "admin-1",
        username: "admin@vensailabs.in",
        user: { workEmail: "admin@vensailabs.in", email: "admin@vensailabs.in" },
      },
      {
        id: "acc-dev",
        userId: "dev-1",
        username: "dev@vensailabs.in",
        user: { workEmail: null, email: null },
      },
    ]);

    const matches = await findResendMailboxesForRecipients(["someone.unknown@vensailabs.in"]);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("acc-admin");
  });

  it("does not fallback if recipient is not on company domain", async () => {
    (prismadb.emailAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: "acc-admin",
        userId: "admin-1",
        username: "admin@vensailabs.in",
        user: { workEmail: "admin@vensailabs.in", email: "admin@vensailabs.in" },
      },
    ]);

    const matches = await findResendMailboxesForRecipients(["stranger@externaldomain.com"]);
    expect(matches).toHaveLength(0);
  });
});

describe("syncResendInbound", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("returns zero counts if API key is missing", async () => {
    (getResendApiKey as jest.Mock).mockResolvedValue(null);
    const result = await syncResendInbound();
    expect(result).toEqual({ synced: 0, newMessages: 0 });
  });

  it("fetches received emails from Resend and skips duplicates", async () => {
    (getResendApiKey as jest.Mock).mockResolvedValue("re_test_123");

    const mockResendItems = [
      {
        id: "msg-1",
        to: ["dhoni@vensailabs.in"],
        from: "sender@gmail.com",
        message_id: "<rfc-1@gmail.com>",
      },
      {
        id: "msg-2",
        to: ["dhoni@vensailabs.in"],
        from: "sender2@gmail.com",
        message_id: "<rfc-2@gmail.com>",
      },
    ];

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith("/emails/receiving")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockResendItems }),
        });
      }
      if (url.includes("/emails/receiving/msg-2")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "msg-2",
              from: "sender2@gmail.com",
              to: ["dhoni@vensailabs.in"],
              subject: "Test subject",
              text: "Hello",
              html: "<p>Hello</p>",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    (prismadb.emailAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: "acc-1",
        userId: "user-1",
        username: "dhoni@vensailabs.in",
        user: { workEmail: null, email: null },
      },
    ]);

    (prismadb.emailAccount.findUnique as jest.Mock).mockResolvedValue({
      id: "acc-1",
      delegateUserIds: [],
    });

    // Pretend msg-1 is already in DB
    (prismadb.email.findMany as jest.Mock).mockResolvedValue([
      { rfcMessageId: "rfc-1@gmail.com", emailAccountId: "acc-1" },
    ]);

    (prismadb.email.findUnique as jest.Mock).mockResolvedValue(null);
    (prismadb.email.create as jest.Mock).mockResolvedValue({ id: "email-new-1" });
    (prismadb.emailAccount.update as jest.Mock).mockResolvedValue({ id: "acc-1" });

    const result = await syncResendInbound("acc-1");
    expect(result.synced).toBe(2);
    expect(result.newMessages).toBe(1);
    expect(prismadb.email.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailAccountId: "acc-1",
          subject: "Test subject",
          fromEmail: "sender2@gmail.com",
        }),
      })
    );
  });
});
