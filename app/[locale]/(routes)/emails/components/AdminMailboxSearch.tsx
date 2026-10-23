"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { searchMailboxesForAdmin } from "@/actions/emails/accessible-accounts";
import type { AccessibleEmailAccount } from "@/actions/emails/accessible-accounts";

export function AdminMailboxSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccessibleEmailAccount[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchMailboxesForAdmin(q).then((rows) => {
        if (!cancelled) setResults(rows);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function openMailbox(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("accountId", id);
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(`?${p.toString()}`);
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Open a mailbox"
        className="h-8 text-xs"
        aria-label="Search mailboxes by name"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-xs shadow-md">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => openMailbox(row.id)}
              >
                <span className="block truncate font-medium">{row.ownerName ?? row.label}</span>
                <span className="block truncate text-muted-foreground">{row.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
