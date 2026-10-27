import {
  isCeoOrSuperAdminUser,
  resolveMailboxAccess,
} from "@/lib/email/mailbox-access";
import { getAccessibleEmailAccounts } from "@/actions/emails/accessible-accounts";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    emailAccount: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockUsersFindUnique = prismadb.users.findUnique as jest.MockedFunction<typeof prismadb.users.findUnique>;
const mockEmailAccountFindUnique = prismadb.emailAccount.findUnique as jest.MockedFunction<typeof prismadb.emailAccount.findUnique>;
const mockEmailAccountFindMany = prismadb.emailAccount.findMany as jest.MockedFunction<typeof prismadb.emailAccount.findMany>;

describe("isCeoOrSuperAdminUser", () => {
  it("grants elevated access to ceo@vensailabs.in with admin role", () => {
    expect(
      isCeoOrSuperAdminUser({
        email: "ceo@vensailabs.in",
        workEmail: "ceo@vensailabs.in",
        role: "admin",
      })
    ).toBe(true);
  });

  it("grants elevated access if workEmail is ceo@vensailabs.in", () => {
    expect(
      isCeoOrSuperAdminUser({
        email: "jaybabu0610@gmail.com",
        workEmail: "ceo@vensailabs.in",
        role: "admin",
      })
    ).toBe(true);
  });

  it("denies elevated access to admin users whose email is NOT ceo@vensailabs.in", () => {
    expect(
      isCeoOrSuperAdminUser({
        email: "akhilrathod03@gmail.com",
        workEmail: "akhil@vensailabs.in",
        role: "admin",
      })
    ).toBe(false);
  });

  it("denies elevated access to non-admin users even if email is ceo@vensailabs.in", () => {
    expect(
      isCeoOrSuperAdminUser({
        email: "ceo@vensailabs.in",
        workEmail: "ceo@vensailabs.in",
        role: "user",
      })
    ).toBe(false);
  });

  it("denies access to undefined or null", () => {
    expect(isCeoOrSuperAdminUser(null)).toBe(false);
    expect(isCeoOrSuperAdminUser(undefined)).toBe(false);
  });
});

describe("resolveMailboxAccess (Delegation & Access Control)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const akhilUserId = "user-akhil";
  const ceoUserId = "user-ceo";
  const colleagueUserId = "user-colleague";

  const akhilMailbox = {
    id: "mb-akhil",
    userId: akhilUserId,
    username: "akhil@vensailabs.in",
    fromName: "Akhil",
    label: "Akhil Mail",
    sendProvider: "RESEND" as const,
    delegateUserIds: [] as string[],
    isActive: true,
  };

  const colleagueMailbox = {
    id: "mb-colleague",
    userId: colleagueUserId,
    username: "colleague@vensailabs.in",
    fromName: "Colleague",
    label: "Colleague Mail",
    sendProvider: "RESEND" as const,
    delegateUserIds: [] as string[],
    isActive: true,
  };

  it("allows Akhil to access his own mailbox as owner", async () => {
    mockGetSession.mockResolvedValue({ user: { id: akhilUserId } } as any);
    mockEmailAccountFindUnique.mockResolvedValue(akhilMailbox as any);

    const access = await resolveMailboxAccess("mb-akhil");
    expect(access.accessKind).toBe("owner");
    expect(access.canSend).toBe(true);
    expect(access.username).toBe("akhil@vensailabs.in");
  });

  it("denies Akhil access to another user's mailbox when not delegated, even if Akhil is admin", async () => {
    mockGetSession.mockResolvedValue({ user: { id: akhilUserId, role: "admin" } } as any);
    mockUsersFindUnique.mockResolvedValue({
      id: akhilUserId,
      email: "akhilrathod03@gmail.com",
      workEmail: "akhil@vensailabs.in",
      role: "admin",
    } as any);
    mockEmailAccountFindUnique.mockResolvedValue(colleagueMailbox as any);

    await expect(resolveMailboxAccess("mb-colleague")).rejects.toThrow("Account not found");
  });

  it("allows Akhil to access colleague's mailbox if colleague added Akhil as delegate", async () => {
    mockGetSession.mockResolvedValue({ user: { id: akhilUserId } } as any);
    mockEmailAccountFindUnique.mockResolvedValue({
      ...colleagueMailbox,
      delegateUserIds: [akhilUserId],
    } as any);

    const access = await resolveMailboxAccess("mb-colleague");
    expect(access.accessKind).toBe("delegate");
    expect(access.canSend).toBe(true);
    expect(access.username).toBe("colleague@vensailabs.in");
  });

  it("allows ceo@vensailabs.in to access any mailbox as admin", async () => {
    mockGetSession.mockResolvedValue({ user: { id: ceoUserId, role: "admin" } } as any);
    mockUsersFindUnique.mockResolvedValue({
      id: ceoUserId,
      email: "ceo@vensailabs.in",
      workEmail: "ceo@vensailabs.in",
      role: "admin",
    } as any);
    mockEmailAccountFindUnique.mockResolvedValue(colleagueMailbox as any);

    const access = await resolveMailboxAccess("mb-colleague");
    expect(access.accessKind).toBe("admin");
    expect(access.canSend).toBe(true);
    expect(access.username).toBe("colleague@vensailabs.in");
  });
});

describe("getAccessibleEmailAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const akhilUserId = "user-akhil";
  const ceoUserId = "user-ceo";

  it("returns only own and delegated mailboxes for Akhil", async () => {
    mockGetSession.mockResolvedValue({ user: { id: akhilUserId } } as any);
    mockUsersFindUnique.mockResolvedValue({
      id: akhilUserId,
      email: "akhil@vensailabs.in",
      workEmail: "akhil@vensailabs.in",
      role: "admin",
    } as any);

    mockEmailAccountFindMany.mockResolvedValue([
      {
        id: "mb-akhil",
        label: "Akhil Mail",
        username: "akhil@vensailabs.in",
        fromName: "Akhil",
        userId: akhilUserId,
        delegateUserIds: [],
        user: { name: "Akhil", email: "akhil@vensailabs.in" },
      },
      {
        id: "mb-delegated",
        label: "Shared Sales Mail",
        username: "sales@vensailabs.in",
        fromName: "Sales Team",
        userId: "user-other",
        delegateUserIds: [akhilUserId],
        user: { name: "Sales Lead", email: "sales@vensailabs.in" },
      },
    ] as any);

    const accounts = await getAccessibleEmailAccounts();

    expect(mockEmailAccountFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ userId: akhilUserId }, { delegateUserIds: { has: akhilUserId } }],
        },
      })
    );

    expect(accounts).toHaveLength(2);
    expect(accounts[0].accessKind).toBe("owner");
    expect(accounts[1].accessKind).toBe("delegate");
  });

  it("returns all active mailboxes across the CRM for ceo@vensailabs.in", async () => {
    mockGetSession.mockResolvedValue({ user: { id: ceoUserId } } as any);
    mockUsersFindUnique.mockResolvedValue({
      id: ceoUserId,
      email: "ceo@vensailabs.in",
      workEmail: "ceo@vensailabs.in",
      role: "admin",
    } as any);

    mockEmailAccountFindMany.mockResolvedValue([
      {
        id: "mb-ceo",
        label: "CEO Mail",
        username: "ceo@vensailabs.in",
        fromName: "CEO",
        userId: ceoUserId,
        delegateUserIds: [],
        user: { name: "CEO", email: "ceo@vensailabs.in" },
      },
      {
        id: "mb-akhil",
        label: "Akhil Mail",
        username: "akhil@vensailabs.in",
        fromName: "Akhil",
        userId: akhilUserId,
        delegateUserIds: [],
        user: { name: "Akhil", email: "akhil@vensailabs.in" },
      },
    ] as any);

    const accounts = await getAccessibleEmailAccounts();

    expect(mockEmailAccountFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      })
    );

    expect(accounts).toHaveLength(2);
    expect(accounts[0].accessKind).toBe("owner");
    expect(accounts[1].accessKind).toBe("admin");
  });
});
