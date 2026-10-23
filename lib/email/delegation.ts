export const DELEGATE_PERMISSIONS = ["READ_ONLY", "SEND_ON_BEHALF", "SEND_AS"] as const;

export type DelegatePermission = (typeof DELEGATE_PERMISSIONS)[number];

export const DELEGATE_PERMISSION_LABELS: Record<DelegatePermission, string> = {
  READ_ONLY: "Read only",
  SEND_ON_BEHALF: "Send on behalf",
  SEND_AS: "Send as",
};

export function isDelegatePermission(value: string): value is DelegatePermission {
  return (DELEGATE_PERMISSIONS as readonly string[]).includes(value);
}

/** What a granted delegate may do. Read only cannot send. */
export function accessFromDelegatePermission(permission: DelegatePermission): {
  canSend: boolean;
  sendStyle: "send_as" | "on_behalf";
} {
  if (permission === "READ_ONLY") return { canSend: false, sendStyle: "send_as" };
  if (permission === "SEND_ON_BEHALF") return { canSend: true, sendStyle: "on_behalf" };
  return { canSend: true, sendStyle: "send_as" };
}

export function onBehalfFromName(actorName: string, ownerName: string): string {
  return `${actorName} on behalf of ${ownerName}`;
}
