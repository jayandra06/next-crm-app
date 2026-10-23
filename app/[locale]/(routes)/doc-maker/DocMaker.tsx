"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocLetter, saveDocLetter, uploadLetterhead } from "@/actions/doc-maker/letters";

export type LetterheadView = {
  name: string;
  accentColor: string;
  contactLines: string[];
  headerUrl: string;
  footerUrl: string;
  /** Quiet left/right margin as a fraction of the page width. */
  sideMarginRatio: number;
};

export type LetterListItem = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

type Props = {
  letterhead: LetterheadView | null;
  letters: LetterListItem[];
  canUpload: boolean;
  canCreate: boolean;
};

export function DocMaker({ letterhead, letters, canUpload, canCreate }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(letters[0]?.id ?? null);
  const active = letters.find((letter) => letter.id === activeId) ?? null;
  const [title, setTitle] = useState(active?.title ?? "");
  const [body, setBody] = useState(active?.body ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function openLetter(letter: LetterListItem | null) {
    setActiveId(letter?.id ?? null);
    setTitle(letter?.title ?? "");
    setBody(letter?.body ?? "");
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setUploading(true);
    const result = await uploadLetterhead(formData);
    setUploading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Letterhead ready. Write in the space between the header and footer.");
    router.refresh();
  }

  async function onSave() {
    setSaving(true);
    const result = await saveDocLetter({ id: activeId ?? undefined, title, body });
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setActiveId(result.id);
    toast.success("Letter saved");
    router.refresh();
  }

  async function onDelete() {
    if (!activeId) return;
    const result = await deleteDocLetter(activeId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    openLetter(null);
    toast.success("Letter removed");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Letters</h2>
          {canCreate && letterhead && (
            <Button type="button" size="sm" variant="outline" onClick={() => openLetter(null)}>
              New
            </Button>
          )}
        </div>
        <ul className="space-y-1">
          {letters.length === 0 && <li className="text-sm text-muted-foreground">No letters yet.</li>}
          {letters.map((letter) => (
            <li key={letter.id}>
              <button
                type="button"
                onClick={() => openLetter(letter)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  letter.id === activeId ? "bg-accent font-medium" : "hover:bg-muted"
                }`}
              >
                <span className="block truncate">{letter.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(letter.updatedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {canUpload && (
          <label className="block space-y-2 rounded-lg border border-dashed p-3 text-sm">
            <span className="font-medium">{letterhead ? "Replace letterhead" : "Upload letterhead PDF"}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full text-xs"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void onUpload(file);
              }}
            />
            <span className="block text-xs text-muted-foreground">
              {uploading ? "Reading the PDF…" : "One page. Header and footer are kept."}
            </span>
          </label>
        )}
      </aside>

      <section className="space-y-4">
        {!letterhead ? (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            {canUpload
              ? "Upload the letterhead PDF. Doc maker keeps the logo, colours, contact details, header, and footer, and opens the middle for your letter."
              : "An admin or manager needs to upload the company letterhead PDF before letters can be written."}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-sm border" style={{ backgroundColor: letterhead.accentColor }} />
                Colour from the letterhead
              </span>
              <span className="text-muted-foreground">{letterhead.name}</span>
            </div>
            {letterhead.contactLines.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Read from the letterhead: {letterhead.contactLines.join(" · ")}
              </p>
            )}
            <div className="mx-auto max-w-[760px] overflow-hidden rounded-md border bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={letterhead.headerUrl} alt="Letterhead header" className="w-full" />
              <div
                className="space-y-3 py-6"
                style={{
                  paddingLeft: `${Math.round(letterhead.sideMarginRatio * 1000) / 10}%`,
                  paddingRight: `${Math.round(letterhead.sideMarginRatio * 1000) / 10}%`,
                }}
              >
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Letter title"
                  disabled={!canCreate}
                  className="border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                  style={{ color: letterhead.accentColor }}
                />
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write the letter here. The header and footer stay in place."
                  disabled={!canCreate}
                  className="min-h-[280px] resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={letterhead.footerUrl} alt="Letterhead footer" className="w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreate && (
                <Button type="button" onClick={() => void onSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save letter"}
                </Button>
              )}
              {activeId && (
                <Button type="button" variant="outline" asChild>
                  <a href={`/api/doc-maker/letters/${activeId}/pdf`}>Download PDF</a>
                </Button>
              )}
              {activeId && canCreate && (
                <Button type="button" variant="ghost" onClick={() => void onDelete()}>
                  Delete
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
