"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Extension, Mark } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { Bold, Italic, List, ListOrdered, Strikethrough, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clampOfferMargins, type OfferMargins } from "@/lib/hrm/offer-doc";
import { generateOfferLetter, saveOfferDraft, sendOfferLetter } from "@/actions/hrm/offer-letter";

const PREVIEW_WIDTH = 680;
const FONTS = [
  { id: "sans-serif", label: "Sans" },
  { id: "Arial", label: "Arial" },
  { id: "Times New Roman", label: "Times" },
] as const;
const SIZES = ["11pt", "12pt", "14pt", "16pt", "18pt"];

type Letterhead = {
  name: string;
  accentColor: string;
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  footerHeight: number;
  headerUrl: string;
  footerUrl: string;
};

type PageLayout = {
  contentPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  headerPx: number;
  footerPx: number;
  headerUrl: string;
  footerUrl: string;
  onTail: (tailPx: number) => void;
};

const layoutKey = new PluginKey<DecorationSet>("offer-pages");

const TextLook = Mark.create({
  name: "textLook",
  inclusive: true,
  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontFamily?.replace(/["']/g, "") || null,
        renderHTML: () => ({}),
      },
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const fontFamily = element.style.fontFamily?.replace(/["']/g, "") || null;
          const fontSize = element.style.fontSize || null;
          if (!fontFamily && !fontSize) return false;
          return { fontFamily, fontSize };
        },
      },
    ];
  },
  renderHTML({ mark }) {
    const styles: string[] = [];
    if (typeof mark.attrs.fontFamily === "string" && mark.attrs.fontFamily) {
      styles.push(`font-family: ${mark.attrs.fontFamily}`);
    }
    if (typeof mark.attrs.fontSize === "string" && mark.attrs.fontSize) {
      styles.push(`font-size: ${mark.attrs.fontSize}`);
    }
    return ["span", { style: styles.join("; ") }, 0];
  },
});

function buildGap(layout: PageLayout, spacerPx: number) {
  const el = document.createElement("div");
  el.className = "offer-page-gap";
  el.contentEditable = "false";
  el.style.marginLeft = `-${layout.marginLeftPx}px`;
  el.style.marginRight = `-${layout.marginRightPx}px`;
  el.style.width = `calc(100% + ${layout.marginLeftPx + layout.marginRightPx}px)`;
  el.style.userSelect = "none";

  const spacer = document.createElement("div");
  spacer.style.height = `${spacerPx + layout.marginBottomPx}px`;

  const footer = document.createElement("img");
  footer.src = layout.footerUrl;
  footer.alt = "";
  footer.draggable = false;
  footer.style.display = "block";
  footer.style.width = "100%";
  footer.style.height = `${layout.footerPx}px`;
  footer.style.objectFit = "fill";

  const band = document.createElement("div");
  band.style.height = "28px";
  band.style.background = "#e7e5e4";

  const header = document.createElement("img");
  header.src = layout.headerUrl;
  header.alt = "";
  header.draggable = false;
  header.style.display = "block";
  header.style.width = "100%";
  header.style.height = `${layout.headerPx}px`;
  header.style.objectFit = "fill";

  const top = document.createElement("div");
  top.style.height = `${layout.marginTopPx}px`;
  el.append(spacer, footer, band, header, top);
  return el;
}

function pageBreaks(layoutRef: { current: PageLayout }) {
  return Extension.create({
    name: "offerPageBreaks",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: layoutKey,
          state: {
            init: () => DecorationSet.empty,
            apply(tr, old) {
              const next = tr.getMeta(layoutKey);
              if (next instanceof DecorationSet) return next;
              if (tr.docChanged) return old.map(tr.mapping, tr.doc);
              return old;
            },
          },
          props: {
            decorations(state) {
              return layoutKey.getState(state) ?? DecorationSet.empty;
            },
          },
          view() {
            let last = "";
            let previous = "";
            let frame = 0;
            const measure = (view: EditorView) => {
              const layout = layoutRef.current;
              if (layout.contentPx < 80) return;
              const blocks = Array.from(view.dom.children).filter(
                (node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains("offer-page-gap")
              );
              let used = 0;
              const widgets: ReturnType<typeof Decoration.widget>[] = [];
              const parts: string[] = [];
              for (const block of blocks) {
                const height = block.offsetHeight;
                if (height <= 0) continue;
                if (used > 0 && used + height > layout.contentPx && height < layout.contentPx * 1.4) {
                  let pos: number | null = null;
                  try {
                    const raw = view.posAtDOM(block, 0);
                    const resolved = view.state.doc.resolve(raw);
                    pos = resolved.depth >= 1 ? resolved.before(1) : null;
                  } catch {
                    pos = null;
                  }
                  if (pos != null) {
                    const spacer = Math.max(0, layout.contentPx - used);
                    parts.push(`${pos}:${Math.round(spacer)}`);
                    widgets.push(
                      Decoration.widget(pos, () => buildGap(layout, spacer), {
                        side: -1,
                        ignoreSelection: true,
                        key: `gap-${pos}`,
                      })
                    );
                  }
                  used = height;
                } else {
                  used += height;
                }
              }
              const signature = `${Math.round(layout.contentPx)}:${parts.join("|")}`;
              layout.onTail(Math.max(0, layout.contentPx - used));
              if (signature === last || signature === previous) return;
              previous = last;
              last = signature;
              view.dispatch(view.state.tr.setMeta(layoutKey, DecorationSet.create(view.state.doc, widgets)));
            };
            return {
              update(view) {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => measure(view));
              },
              destroy() {
                cancelAnimationFrame(frame);
              },
            };
          },
        }),
      ];
    },
  });
}

export function OfferStudio({
  candidateId,
  initialHtml,
  initialMargins,
  letterhead,
  offerSentAt,
}: {
  candidateId: string;
  initialHtml: string;
  initialMargins: OfferMargins;
  letterhead: Letterhead | null;
  offerSentAt: string | null;
}) {
  const [margins, setMargins] = useState(initialMargins);
  const [prompt, setPrompt] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tailPx, setTailPx] = useState(0);
  const [, setTick] = useState(0);
  const tailRef = useRef(0);

  const scale = letterhead ? PREVIEW_WIDTH / letterhead.pageWidth : 1;
  const headerPx = letterhead ? letterhead.headerHeight * scale : 0;
  const footerPx = letterhead ? letterhead.footerHeight * scale : 0;
  const pagePx = letterhead ? letterhead.pageHeight * scale : 0;
  const marginTopPx = margins.top * scale;
  const marginRightPx = margins.right * scale;
  const marginBottomPx = margins.bottom * scale;
  const marginLeftPx = margins.left * scale;
  const contentPx = Math.max(120, pagePx - headerPx - footerPx - marginTopPx - marginBottomPx);

  const layoutRef = useRef<PageLayout>({
    contentPx,
    marginLeftPx,
    marginRightPx,
    marginTopPx,
    marginBottomPx,
    headerPx,
    footerPx,
    headerUrl: letterhead?.headerUrl ?? "",
    footerUrl: letterhead?.footerUrl ?? "",
    onTail: () => undefined,
  });
  layoutRef.current = {
    contentPx,
    marginLeftPx,
    marginRightPx,
    marginTopPx,
    marginBottomPx,
    headerPx,
    footerPx,
    headerUrl: letterhead?.headerUrl ?? "",
    footerUrl: letterhead?.footerUrl ?? "",
    onTail: (tail) => {
      const next = Math.round(tail);
      if (next === tailRef.current) return;
      tailRef.current = next;
      setTailPx(next);
    },
  };

  const breaksRef = useRef<ReturnType<typeof pageBreaks> | null>(null);
  if (!breaksRef.current) breaksRef.current = pageBreaks(layoutRef);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      Underline,
      TextLook,
      breaksRef.current,
    ],
    content: initialHtml || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "outline-none text-[11pt] leading-relaxed" },
    },
    onUpdate: () => setTick((value) => value + 1),
    onSelectionUpdate: () => setTick((value) => value + 1),
  });

  useEffect(() => {
    if (!editor) return;
    let el: HTMLElement;
    try {
      el = editor.view.dom as HTMLElement;
    } catch {
      return;
    }
    el.style.paddingTop = `${marginTopPx}px`;
    el.style.paddingRight = `${marginRightPx}px`;
    el.style.paddingLeft = `${marginLeftPx}px`;
    el.style.paddingBottom = "0px";
    el.style.minHeight = `${contentPx + marginTopPx}px`;
    el.style.boxSizing = "border-box";
    editor.view.dispatch(editor.state.tr.setMeta("offer-layout", true));
  }, [editor, marginTopPx, marginRightPx, marginLeftPx, contentPx]);

  function applyLook(partial: { fontFamily?: string; fontSize?: string }) {
    if (!editor) return;
    const current = editor.getAttributes("textLook") as { fontFamily?: string | null; fontSize?: string | null };
    editor
      .chain()
      .focus()
      .setMark("textLook", {
        fontFamily: partial.fontFamily ?? current.fontFamily ?? null,
        fontSize: partial.fontSize ?? current.fontSize ?? null,
      })
      .run();
  }

  function dragMargin(edge: keyof OfferMargins, event: React.PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = margins;
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / scale;
      const dy = (pointer.clientY - startY) / scale;
      setMargins(
        clampOfferMargins({
          top: edge === "top" ? start.top + dy : start.top,
          bottom: edge === "bottom" ? start.bottom - dy : start.bottom,
          left: edge === "left" ? start.left + dx : start.left,
          right: edge === "right" ? start.right - dx : start.right,
        })
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  async function persist() {
    if (!editor) return { error: "The editor is still loading" };
    return saveOfferDraft({
      candidateId,
      html: editor.getHTML(),
      doc: editor.getJSON(),
      margins,
    });
  }

  async function onSave() {
    setBusy("save");
    setError(null);
    setNote(null);
    try {
      const result = await persist();
      if ("error" in result && result.error) setError(result.error);
      else setNote("Saved");
    } finally {
      setBusy(null);
    }
  }

  async function onPreview() {
    setBusy("preview");
    setError(null);
    setNote(null);
    try {
      const result = await persist();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      window.open(`/api/hrm/offers/${candidateId}/pdf`, "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!window.confirm("Email this offer letter and mark the candidate as hired?")) return;
    setBusy("send");
    setError(null);
    setNote(null);
    try {
      const saved = await persist();
      if ("error" in saved && saved.error) {
        setError(saved.error);
        return;
      }
      const result = await sendOfferLetter(candidateId);
      if ("error" in result && result.error) setError(result.error);
      else setNote("Offer emailed");
    } finally {
      setBusy(null);
    }
  }

  async function onAi(action: "draft" | "improve" | "shorten" | "formal") {
    if (!editor) return;
    setBusy(action);
    setError(null);
    setNote(null);
    try {
      const result = await generateOfferLetter({
        candidateId,
        prompt,
        action,
        existingHtml: editor.getHTML(),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      editor.commands.setContent(result.html);
      setNote("Draft updated. Edit anything before you send it.");
    } finally {
      setBusy(null);
    }
  }

  if (!letterhead) {
    return (
      <section className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">
          Upload the company letterhead in Doc maker first. Use the offer-letter PDF so the header and footer match.
        </p>
        <Link href="/doc-maker" className="text-sm font-medium underline">
          Open Doc maker
        </Link>
      </section>
    );
  }

  const toolClass = (active: boolean) =>
    `h-8 rounded-lg px-2 text-xs ${active ? "bg-muted" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-background p-2">
        <Button type="button" variant="ghost" className={toolClass(Boolean(editor?.isActive("heading", { level: 1 })))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </Button>
        <Button type="button" variant="ghost" className={toolClass(Boolean(editor?.isActive("heading", { level: 2 })))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Button>
        <Button type="button" variant="ghost" className={toolClass(Boolean(editor?.isActive("heading", { level: 3 })))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bullets" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <select
          aria-label="Font"
          className="h-8 rounded-lg border bg-background px-2 text-xs"
          defaultValue="sans-serif"
          onChange={(event) => applyLook({ fontFamily: event.target.value })}
        >
          {FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Font size"
          className="h-8 rounded-lg border bg-background px-2 text-xs"
          defaultValue="11pt"
          onChange={(event) => applyLook({ fontSize: event.target.value })}
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        {(["top", "right", "bottom", "left"] as const).map((edge) => (
          <label key={edge} className="space-y-1">
            <span className="capitalize text-muted-foreground">{edge}</span>
            <input
              type="number"
              min={8}
              max={96}
              value={margins[edge]}
              className="block h-8 w-16 rounded-lg border bg-background px-2"
              onChange={(event) => setMargins(clampOfferMargins({ ...margins, [edge]: Number(event.target.value) }))}
            />
          </label>
        ))}
        <span className="pb-2 text-muted-foreground">Margins are in points. Drag the edges of the page too.</span>
      </div>

      <section className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Assistant</p>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: two-page internship offer, mention the reporting manager, keep the pay as entered"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => onAi("draft")}>
            {busy === "draft" ? "Writing…" : "Draft"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => onAi("improve")}>
            Improve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => onAi("shorten")}>
            Shorter
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => onAi("formal")}>
            More formal
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto bg-muted/40 py-6">
        <div className="relative mx-auto bg-white shadow-md" style={{ width: PREVIEW_WIDTH }}>
          <img src={letterhead.headerUrl} alt="" className="block w-full" style={{ height: headerPx }} />
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:text-[18pt] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-[var(--offer-accent)] [&_.ProseMirror_h2]:text-[15pt] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:text-[13pt] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5"
            style={{ color: "#1c1917", ["--offer-accent" as string]: letterhead.accentColor }}
          />
          <div style={{ height: tailPx + marginBottomPx }} />
          <img src={letterhead.footerUrl} alt="" className="block w-full" style={{ height: footerPx }} />
          <div
            role="separator"
            aria-label="Drag left margin"
            className="absolute bottom-0 w-1.5 cursor-col-resize bg-primary/0 hover:bg-primary/30"
            style={{ left: Math.max(0, marginLeftPx - 3), top: headerPx }}
            onPointerDown={(event) => dragMargin("left", event)}
          />
          <div
            role="separator"
            aria-label="Drag right margin"
            className="absolute bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30"
            style={{ right: Math.max(0, marginRightPx - 3), top: headerPx }}
            onPointerDown={(event) => dragMargin("right", event)}
          />
          <div
            role="separator"
            aria-label="Drag top margin"
            className="absolute h-1.5 cursor-row-resize hover:bg-primary/30"
            style={{ top: headerPx + marginTopPx, left: marginLeftPx, right: marginRightPx }}
            onPointerDown={(event) => dragMargin("top", event)}
          />
          <div
            role="separator"
            aria-label="Drag bottom margin"
            className="absolute h-1.5 cursor-row-resize hover:bg-primary/30"
            style={{ top: headerPx + marginTopPx + contentPx, left: marginLeftPx, right: marginRightPx }}
            onPointerDown={(event) => dragMargin("bottom", event)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Paste from ChatGPT works. When a page is full, the next paragraph moves onto the following page. The downloaded
        PDF uses the same letterhead and margins.
      </p>
      {offerSentAt ? <p className="text-sm text-muted-foreground">Last emailed {new Date(offerSentAt).toLocaleString()}.</p> : null}
      {note ? <p className="text-sm">{note}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={onSave}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={onPreview}>
          {busy === "preview" ? "Preparing…" : "Save and preview PDF"}
        </Button>
        <Button type="button" disabled={busy !== null} onClick={onSend}>
          {busy === "send" ? "Sending…" : "Email offer and hire"}
        </Button>
      </div>
    </div>
  );
}
