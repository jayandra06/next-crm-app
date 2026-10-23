import { accessFromDelegatePermission, onBehalfFromName } from "@/lib/email/delegation";

describe("accessFromDelegatePermission", () => {
  it("read only cannot send", () => {
    expect(accessFromDelegatePermission("READ_ONLY")).toEqual({
      canSend: false,
      sendStyle: "send_as",
    });
  });

  it("send on behalf can send with the on-behalf style", () => {
    expect(accessFromDelegatePermission("SEND_ON_BEHALF")).toEqual({
      canSend: true,
      sendStyle: "on_behalf",
    });
  });

  it("send as can send as the mailbox", () => {
    expect(accessFromDelegatePermission("SEND_AS").canSend).toBe(true);
    expect(onBehalfFromName("Ada", "Sales")).toBe("Ada on behalf of Sales");
  });
});
