"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DELEGATE_PERMISSION_LABELS,
  DELEGATE_PERMISSIONS,
  type DelegatePermission,
} from "@/lib/email/delegation";
import {
  grantMailboxDelegate,
  listDelegatesForAccount,
  revokeMailboxDelegate,
  searchUsersForDelegation,
  updateMailboxDelegatePermission,
  type DelegationUserMatch,
  type MailboxDelegateGrant,
} from "@/actions/emails/delegates";

type Mailbox = { id: string; label: string; username: string };

type Props =
  | { mode: "self"; mailboxes: Mailbox[]; initialGrants: MailboxDelegateGrant[] }
  | { mode: "admin" };

export function DelegateSettings(props: Props) {
  const router = useRouter();
  const [permission, setPermission] = useState<DelegatePermission>("READ_ONLY");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [grants, setGrants] = useState<MailboxDelegateGrant[]>(
    props.mode === "self" ? props.initialGrants : []
  );
  const [accountId, setAccountId] = useState(props.mode === "self" ? props.mailboxes[0]?.id ?? "" : "");

  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerHits, setOwnerHits] = useState<DelegationUserMatch[]>([]);
  const [owner, setOwner] = useState<DelegationUserMatch | null>(null);
  const [delegateQuery, setDelegateQuery] = useState("");
  const [delegateHits, setDelegateHits] = useState<DelegationUserMatch[]>([]);
  const [delegate, setDelegate] = useState<DelegationUserMatch | null>(null);

  useEffect(() => {
    if (props.mode !== "admin") return;
    const q = ownerQuery.trim();
    if (q.length < 2 || owner) {
      setOwnerHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchUsersForDelegation(q).then((rows) => {
        if (!cancelled) setOwnerHits(rows);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ownerQuery, owner, props.mode]);

  useEffect(() => {
    if (props.mode !== "admin") return;
    const q = delegateQuery.trim();
    if (q.length < 2 || delegate) {
      setDelegateHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchUsersForDelegation(q).then((rows) => {
        if (!cancelled) setDelegateHits(rows);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [delegateQuery, delegate, props.mode]);

  async function refreshGrants(nextAccountId: string) {
    if (!nextAccountId) {
      setGrants([]);
      return;
    }
    const rows = await listDelegatesForAccount(nextAccountId);
    setGrants(rows);
  }

  async function giveAccess() {
    if (!accountId) {
      toast.error(props.mode === "admin" ? "Search for a mailbox owner first" : "Add a mailbox first");
      return;
    }
    if (props.mode === "admin" && !delegate) {
      toast.error("Search for the person who should get access");
      return;
    }
    if (props.mode === "self" && !email.trim()) {
      toast.error("Enter their email");
      return;
    }
    setSaving(true);
    const result = await grantMailboxDelegate(
      props.mode === "admin"
        ? { accountId, userId: delegate?.id, permission }
        : { accountId, email, permission }
    );
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Access saved");
    setEmail("");
    setDelegate(null);
    setDelegateQuery("");
    await refreshGrants(accountId);
    router.refresh();
  }

  async function changePermission(id: string, next: DelegatePermission) {
    const result = await updateMailboxDelegatePermission(id, next);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, permission: next } : g)));
  }

  async function removeGrant(id: string) {
    const result = await revokeMailboxDelegate(id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setGrants((prev) => prev.filter((g) => g.id !== id));
    toast.success("Access removed");
  }

  const visibleGrants =
    props.mode === "self" ? grants.filter((g) => g.accountId === accountId) : grants;

  const adminMailboxes = owner?.mailboxes ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Delegate settings</h2>
          <p className="text-sm text-muted-foreground">
            {props.mode === "admin"
              ? "Search a person, then choose who can use their mailbox and how. Admins can already open every mailbox from E-mails."
              : "Enter someone’s email and choose what they can do with your mailbox. Admins can open every mailbox without a grant."}
          </p>
        </div>

        {props.mode === "self" && props.mailboxes.length === 0 && (
          <p className="text-sm text-muted-foreground">Add a mailbox before you can delegate it.</p>
        )}

        {props.mode === "self" && props.mailboxes.length > 1 && (
          <div className="space-y-2">
            <Label>Your mailbox</Label>
            <Select
              value={accountId}
              onValueChange={(id) => {
                setAccountId(id);
                void refreshGrants(id);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose mailbox" />
              </SelectTrigger>
              <SelectContent>
                {props.mailboxes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} ({m.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {props.mode === "admin" && (
          <div className="space-y-2">
            <Label>Mailbox owner</Label>
            {owner ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="truncate">
                  {owner.name ?? owner.email}
                  <span className="text-muted-foreground"> · {owner.email}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOwner(null);
                    setOwnerQuery("");
                    setAccountId("");
                    setGrants([]);
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={ownerQuery}
                  onChange={(e) => setOwnerQuery(e.target.value)}
                  placeholder="Search by name or email"
                />
                {ownerHits.length > 0 && (
                  <ul className="rounded-md border">
                    {ownerHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setOwner(hit);
                            setOwnerHits([]);
                            const first = hit.mailboxes[0]?.id ?? "";
                            setAccountId(first);
                            if (first) void refreshGrants(first);
                            else setGrants([]);
                          }}
                        >
                          {hit.name ?? hit.email}
                          <span className="text-muted-foreground"> · {hit.email}</span>
                          {hit.mailboxes.length === 0 && (
                            <span className="text-muted-foreground"> · no mailbox</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {adminMailboxes.length > 1 && (
              <Select
                value={accountId}
                onValueChange={(id) => {
                  setAccountId(id);
                  void refreshGrants(id);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose mailbox" />
                </SelectTrigger>
                <SelectContent>
                  {adminMailboxes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} ({m.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          {props.mode === "self" ? (
            <div className="space-y-2">
              <Label htmlFor="delegate-email">Their email</Label>
              <Input
                id="delegate-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Give access to</Label>
              {delegate ? (
                <div className="flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm">
                  <span className="truncate">{delegate.name ?? delegate.email}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDelegate(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={delegateQuery}
                    onChange={(e) => setDelegateQuery(e.target.value)}
                    placeholder="Search by name"
                  />
                  {delegateHits.length > 0 && (
                    <ul className="rounded-md border">
                      {delegateHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => {
                              setDelegate(hit);
                              setDelegateHits([]);
                              setDelegateQuery("");
                            }}
                          >
                            {hit.name ?? hit.email}
                            <span className="text-muted-foreground"> · {hit.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Access</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as DelegatePermission)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELEGATE_PERMISSIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DELEGATE_PERMISSION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void giveAccess()} disabled={saving}>
            {saving ? "Saving…" : "Give access"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Read only can open the mailbox. Send on behalf shows your name on behalf of the owner. Send as
          sends from their address.
        </p>

        {visibleGrants.length > 0 && (
          <ul className="divide-y rounded-md border">
            {visibleGrants.map((grant) => (
              <li key={grant.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{grant.name ?? grant.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {grant.email}
                    {props.mode === "self" && props.mailboxes.length > 1 ? ` · ${grant.accountEmail}` : ""}
                  </p>
                </div>
                <Select
                  value={grant.permission}
                  onValueChange={(v) => void changePermission(grant.id, v as DelegatePermission)}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELEGATE_PERMISSIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {DELEGATE_PERMISSION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => void removeGrant(grant.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
