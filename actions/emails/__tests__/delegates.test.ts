import {
  searchUsersForMailboxShare,
  addMailboxDelegate,
  removeMailboxDelegate,
} from "@/actions/emails/delegates";
import { getDelegatedToMeAccounts } from "@/actions/emails/accounts";
import { requireAuthenticated } from "@/lib/authz";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/authz", () => ({
  requireAuthenticated: jest.fn(),
  requireRole: jest.fn(),
}));

jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const mockRequireAuthenticated = requireAuthenticated as jest.MockedFunction<typeof requireAuthenticated>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEmailAccountFindUnique = prismadb.emailAccount.findUnique as jest.MockedFunction<typeof prismadb.emailAccount.findUnique>;
const mockEmailAccountUpdate = prismadb.emailAccount.update as jest.MockedFunction<typeof prismadb.emailAccount.update>;
const mockEmailAccountFindMany = prismadb.emailAccount.findMany as jest.MockedFunction<typeof prismadb.emailAccount.findMany>;
const mockUsersFindMany = prismadb.users.findMany as jest.MockedFunction<typeof prismadb.users.findMany>;
const mockUsersFindFirst = prismadb.users.findFirst as jest.MockedFunction<typeof prismadb.users.findFirst>;
const mockUsersFindUnique = prismadb.users.findUnique as jest.MockedFunction<typeof prismadb.users.findUnique>;

describe("Delegates Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ownerUserId = "user-akhil";
  const colleagueUserId = "user-rahul";

  const account = {
    id: "account-1",
    userId: ownerUserId,
    username: "akhil@vensailabs.in",
    label: "Akhil Mail",
    delegateUserIds: [] as string[],
  };

  it("searchUsersForMailboxShare returns active users even with empty query", async () => {
    mockRequireAuthenticated.mockResolvedValue({ id: ownerUserId, role: "user" } as any);
    mockUsersFindMany.mockResolvedValue([
      { id: colleagueUserId, name: "Rahul", email: "rahul@vensailabs.in", workEmail: "rahul@vensailabs.in" },
    ] as any);

    const results = await searchUsersForMailboxShare("");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Rahul");
    expect(mockUsersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userStatus: "ACTIVE", banned: false }),
      })
    );
  });

  it("adds a delegate to the user's mailbox", async () => {
    mockRequireAuthenticated.mockResolvedValue({ id: ownerUserId, role: "user" } as any);
    mockEmailAccountFindUnique.mockResolvedValue(account as any);
    mockUsersFindFirst.mockResolvedValue({ id: colleagueUserId } as any);
    mockEmailAccountUpdate.mockResolvedValue({} as any);
    mockUsersFindMany.mockResolvedValue([
      { id: colleagueUserId, name: "Rahul", email: "rahul@vensailabs.in", workEmail: null },
    ] as any);

    const delegates = await addMailboxDelegate("account-1", colleagueUserId);

    expect(mockEmailAccountUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { delegateUserIds: [colleagueUserId] },
    });
    expect(delegates).toHaveLength(1);
    expect(delegates[0].id).toBe(colleagueUserId);
  });

  it("removes a delegate from the user's mailbox", async () => {
    mockRequireAuthenticated.mockResolvedValue({ id: ownerUserId, role: "user" } as any);
    mockEmailAccountFindUnique.mockResolvedValue({
      ...account,
      delegateUserIds: [colleagueUserId],
    } as any);
    mockEmailAccountUpdate.mockResolvedValue({} as any);
    mockUsersFindMany.mockResolvedValue([]);

    const delegates = await removeMailboxDelegate("account-1", colleagueUserId);

    expect(mockEmailAccountUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { delegateUserIds: [] },
    });
    expect(delegates).toHaveLength(0);
  });

  it("denies non-owner non-CEO from modifying delegates", async () => {
    mockRequireAuthenticated.mockResolvedValue({ id: "stranger-user", role: "admin" } as any);
    mockUsersFindUnique.mockResolvedValue({
      id: "stranger-user",
      email: "stranger@vensailabs.in",
      workEmail: "stranger@vensailabs.in",
      role: "admin",
    } as any);
    mockEmailAccountFindUnique.mockResolvedValue(account as any);

    await expect(addMailboxDelegate("account-1", colleagueUserId)).rejects.toThrow(
      "Only the CEO can manage delegated access for any mailbox."
    );
  });

  it("returns mailboxes delegated to the current user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: colleagueUserId } } as any);
    mockEmailAccountFindMany.mockResolvedValue([
      {
        id: "account-1",
        label: "Akhil Mail",
        username: "akhil@vensailabs.in",
        fromName: "Akhil",
        sendProvider: "RESEND",
        user: { id: ownerUserId, name: "Akhil", email: "akhil@vensailabs.in", workEmail: null },
      },
    ] as any);

    const delegated = await getDelegatedToMeAccounts();
    expect(delegated).toHaveLength(1);
    expect(delegated[0].label).toBe("Akhil Mail");
    expect(delegated[0].ownerName).toBe("Akhil");
    expect(mockEmailAccountFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          delegateUserIds: { has: colleagueUserId },
        }),
      })
    );
  });
});
