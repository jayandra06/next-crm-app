describe("mailbox items payload extraction", () => {
  function extractEmailItems(emailsPayload: any) {
    if (!emailsPayload) return [];
    if (Array.isArray(emailsPayload.emails)) return emailsPayload.emails;
    if (Array.isArray(emailsPayload.items)) return emailsPayload.items;
    if (Array.isArray(emailsPayload)) return emailsPayload;
    return [];
  }

  it("extracts from data.emails.emails (MailboxEmailsResult format)", () => {
    const payload = {
      emails: [
        { id: "mail-1", subject: "Hello" },
        { id: "mail-2", subject: "World" },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
      view: "inbox",
    };
    const items = extractEmailItems(payload);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("mail-1");
  });

  it("extracts from data.emails.items (fallback items property)", () => {
    const payload = {
      items: [
        { id: "mail-3", subject: "Test" },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    };
    const items = extractEmailItems(payload);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("mail-3");
  });

  it("extracts from direct array", () => {
    const payload = [{ id: "mail-4", subject: "Direct" }];
    const items = extractEmailItems(payload);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("mail-4");
  });

  it("returns empty array safely if undefined or null without throwing", () => {
    expect(extractEmailItems(null)).toEqual([]);
    expect(extractEmailItems(undefined)).toEqual([]);
    expect(extractEmailItems({})).toEqual([]);
  });
});
