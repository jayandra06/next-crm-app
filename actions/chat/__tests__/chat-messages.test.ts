jest.mock("@/lib/auth-server", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    teamChatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    teamScheduleEntry: {
      findUnique: jest.fn(),
    },
    teamChatRead: {
      upsert: jest.fn(),
    },
  },
}));

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { dmRoomKey, parseRoomKey } from "@/lib/chat/room-keys";
import {
  getChatMessages,
  sendChatMessage,
  parseAttachments,
} from "@/actions/chat/messages";
import { markChatRoomRead } from "@/actions/chat/unread";

describe("Chat System Actions and Helpers", () => {
  const currentUserId = "11111111-1111-1111-1111-111111111111";
  const peerUserId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue({
      user: {
        id: currentUserId,
        name: "Test User",
        email: "test@example.com",
        userStatus: "ACTIVE",
      },
    });
  });

  describe("dmRoomKey & parseRoomKey", () => {
    it("generates deterministic and lowercase room key regardless of order or case", () => {
      const key1 = dmRoomKey("USERA", "userb");
      const key2 = dmRoomKey("userb", "usera");
      expect(key1).toBe("dm:usera:userb");
      expect(key1).toBe(key2);
    });

    it("parses room keys including URI encoded strings", () => {
      expect(parseRoomKey("general")).toBe("general");
      expect(parseRoomKey("")).toBe("general");
      expect(parseRoomKey(undefined)).toBe("general");
      expect(parseRoomKey("dm%3Ausera%3Auserb")).toBe("dm:usera:userb");
      expect(parseRoomKey("conf:123")).toBe("conf:123");
    });
  });

  describe("parseAttachments", () => {
    it("handles null and empty values safely", () => {
      expect(parseAttachments(null, null, null)).toEqual([]);
      expect(parseAttachments("", "", "")).toEqual([]);
    });

    it("parses single attachment backward compatibility", () => {
      const result = parseAttachments(
        "https://example.com/invoice.pdf",
        "invoice.pdf",
        "application/pdf"
      );
      expect(result).toEqual([
        {
          url: "https://example.com/invoice.pdf",
          name: "invoice.pdf",
          mime: "application/pdf",
        },
      ]);
    });

    it("parses multiple JSON-encoded attachments", () => {
      const multi = JSON.stringify([
        { url: "https://example.com/doc1.docx", name: "doc1.docx", mime: "application/msword" },
        { url: "https://example.com/sheet.xlsx", name: "sheet.xlsx", mime: "application/vnd.ms-excel" },
      ]);
      const result = parseAttachments(multi, "2 attachments", "application/json;kind=attachments");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("doc1.docx");
      expect(result[1].name).toBe("sheet.xlsx");
    });
  });

  describe("getChatMessages", () => {
    it("fetches general messages and handles missing user relations gracefully", async () => {
      (prismadb.teamChatMessage.findMany as jest.Mock).mockResolvedValue([
        {
          id: "m1",
          roomKey: "general",
          userId: currentUserId,
          body: "Hello general",
          htmlBody: "<p>Hello general</p>",
          attachmentUrl: null,
          attachmentName: null,
          attachmentMime: null,
          createdAt: new Date("2026-10-23T00:00:00Z"),
          user: null, // Test null user relation fallback
        },
      ]);

      const messages = await getChatMessages("general");
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe("Hello general");
      expect(messages[0].user.id).toBe(currentUserId);
      expect(messages[0].user.name).toBe("Team Member");
    });

    it("enforces DM participant access check safely", async () => {
      const unauthorizedDM = "dm:33333333-3333-3333-3333-333333333333:44444444-4444-4444-4444-444444444444";
      const messages = await getChatMessages(unauthorizedDM);
      // Catch and return [] instead of throwing uncaught 500
      expect(messages).toEqual([]);
      expect(prismadb.teamChatMessage.findMany).not.toHaveBeenCalled();
    });

    it("allows DM access when user is a participant (case-insensitive)", async () => {
      const authorizedDM = dmRoomKey(currentUserId.toUpperCase(), peerUserId);
      (prismadb.teamChatMessage.findMany as jest.Mock).mockResolvedValue([]);

      const messages = await getChatMessages(authorizedDM);
      expect(messages).toEqual([]);
      expect(prismadb.teamChatMessage.findMany).toHaveBeenCalled();
    });
  });

  describe("sendChatMessage", () => {
    it("sends message with multiple attachments and JSON encoding", async () => {
      const roomKey = dmRoomKey(currentUserId, peerUserId);
      const attachments = [
        { url: "https://storage.test/file1.pdf", name: "file1.pdf", mime: "application/pdf" },
        { url: "https://storage.test/file2.docx", name: "file2.docx", mime: "application/msword" },
      ];

      (prismadb.teamChatMessage.create as jest.Mock).mockImplementation(({ data, include }) => {
        return Promise.resolve({
          id: "new-msg-id",
          ...data,
          createdAt: new Date("2026-10-23T01:00:00Z"),
          user: { id: currentUserId, name: "Test User", email: "test@example.com" },
        });
      });

      const result = await sendChatMessage(roomKey, "<p>Here are documents</p>", attachments);

      expect(result.id).toBe("new-msg-id");
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments[0].name).toBe("file1.pdf");
      expect(result.attachments[1].name).toBe("file2.docx");

      // Verify prismadb.create was called with serialized attachments
      expect(prismadb.teamChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roomKey,
            userId: currentUserId,
            attachmentUrl: JSON.stringify(attachments),
            attachmentName: "2 attachments",
          }),
        })
      );
    });
  });

  describe("markChatRoomRead", () => {
    it("executes without throwing unhandled errors", async () => {
      (prismadb.teamChatRead.upsert as jest.Mock).mockResolvedValue({});
      await expect(markChatRoomRead("general")).resolves.not.toThrow();
      expect(prismadb.teamChatRead.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_roomKey: {
              userId: currentUserId,
              roomKey: "general",
            },
          },
        })
      );
    });
  });
});
