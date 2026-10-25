"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { searchUsersForMailboxShare, type MailboxDelegate } from "@/actions/emails/delegates";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function personLine(person: MailboxDelegate) {
  const extra =
    person.workEmail && person.workEmail.toLowerCase() !== person.email.toLowerCase()
      ? person.workEmail
      : null;
  return extra ? `${person.email} · ${extra}` : person.email;
}

export function UserSearchField({
  excludeIds,
  onPick,
  placeholder = "Search by name or email",
  disabled = false,
}: {
  excludeIds: string[];
  onPick: (person: MailboxDelegate) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MailboxDelegate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const excludeKey = excludeIds.slice().sort().join("\0");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const hidden = new Set(excludeKey ? excludeKey.split("\0") : []);
    const timer = window.setTimeout(() => {
      void searchUsersForMailboxShare(q)
        .then((people) => {
          if (cancelled) return;
          setResults(people.filter((person) => !hidden.has(person.id)));
          setSearched(true);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setSearched(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, excludeKey]);

  function pick(person: MailboxDelegate) {
    onPick(person);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const q = query.trim().toLowerCase();
    const exact = results.find(
      (person) =>
        person.email.toLowerCase() === q ||
        person.workEmail?.toLowerCase() === q ||
        person.name.toLowerCase() === q
    );
    if (exact) pick(exact);
    else if (results.length === 1) pick(results[0]);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-controls={listId}
          aria-autocomplete="list"
          className="pl-9"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-xs text-muted-foreground">Type at least 2 characters.</p>
      )}
      {searched && results.length === 0 && !searching && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          No active user matches that name or email. They need a CRM account before you can share this mailbox.
        </p>
      )}
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="overflow-hidden rounded-md border bg-popover">
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                role="option"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                )}
                onClick={() => pick(person)}
              >
                <span className="font-medium">{person.name}</span>
                <span className="text-xs text-muted-foreground">{personLine(person)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
