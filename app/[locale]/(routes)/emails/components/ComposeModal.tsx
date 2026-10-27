"use client";

import { useState, forwardRef, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Minus,
  Maximize2,
  Minimize2,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmail } from "@/actions/emails/messages";
import { EmailComposeEditor } from "@/app/[locale]/(routes)/emails/components/EmailComposeEditor";
import { useRouter } from "next/navigation";
import type { ConnectedAccount, Mail } from "@/app/[locale]/(routes)/emails/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  uploadComposeAttachment,
  type ComposeAttachmentMeta,
} from "@/lib/email/upload-compose-attachment";
import {
  buildForwardedBody,
  buildReplyAllRecipients,
  emailPlainBody,
  plainTextToComposeHtml,
  stripHtmlToPlain,
} from "@/lib/email/compose-helpers";
import { EmailAiWriter } from "@/components/email/EmailAiWriter";
import type { MailboxComposeMode } from "@/lib/llm/quality-modes";
import { getDefaultEmailSignatureHtml } from "@/lib/brand/vensai";
import { cn } from "@/lib/utils";

type Mode = "new" | "reply" | "reply-all" | "forward";

type Props = {
  accountId: string;
  mailboxAddress?: string;
  /** Mailboxes the user may send from (view-as / delegate / own). */
  accounts?: ConnectedAccount[];
  mode?: Mode;
  replyTo?: Mail | null;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  initialTo?: string;
  onSent?: (sentMail?: any) => void;
  onClose?: () => void;
  /** When true, dialog is opened programmatically (no trigger button). */
  headless?: boolean;
  /** Pre-fill AI instructions (e.g. from “AI reply” or assistant). */
  initialAiPrompt?: string;
  /** Run AI generate once when the dialog opens (assistant deep link). */
  autoGenerateAi?: boolean;
};

function initialFields(
  mode: Mode,
  replyTo: Mail | null | undefined,
  mailboxAddress: string,
  initialTo?: string
) {
  if (!replyTo || mode === "new") {
    return { to: initialTo?.trim() ?? "", cc: "", subject: "", body: "", bodyHtml: "<p></p>" };
  }

  if (mode === "reply") {
    return {
      to: replyTo.fromEmail ?? "",
      cc: "",
      subject: replyTo.subject?.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject ?? ""}`,
      body: `\n\n${quoteOriginal(replyTo)}`,
    };
  }

  if (mode === "reply-all") {
    const { to, cc } = buildReplyAllRecipients(replyTo, mailboxAddress);
    return {
      to: to.join(", "),
      cc: cc.join(", "),
      subject: replyTo.subject?.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject ?? ""}`,
      body: `\n\n${quoteOriginal(replyTo)}`,
    };
  }

  return {
    to: "",
    cc: "",
    subject: replyTo.subject?.startsWith("Fwd:") ? replyTo.subject : `Fwd: ${replyTo.subject ?? ""}`,
    body: buildForwardedBody(replyTo),
  };
}

function quoteOriginal(email: Mail): string {
  const from = email.fromName ?? email.fromEmail ?? "";
  const sent = email.sentAt ? new Date(email.sentAt).toLocaleString() : "";
  const body = emailPlainBody(email);
  return `On ${sent}, ${from} wrote:\n> ${body.split("\n").join("\n> ")}`;
}

export const ComposeModal = forwardRef<HTMLDivElement, Props>(function ComposeModal(
  {
    accountId,
    mailboxAddress = "",
    accounts = [],
    mode = "new",
    replyTo,
    trigger,
    defaultOpen = false,
    initialTo,
    onSent,
    onClose,
    headless = false,
    initialAiPrompt = "",
    autoGenerateAi = false,
  }: Props,
  ref
) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [sendFromAccountId, setSendFromAccountId] = useState(accountId);
  const [attachments, setAttachments] = useState<ComposeAttachmentMeta[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quotePlainRef = useRef("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const sendFromAccount =
    accounts.find((a) => a.id === sendFromAccountId) ??
    accounts.find((a) => a.id === accountId);
  const effectiveMailboxAddress = sendFromAccount?.username ?? mailboxAddress;

  useEffect(() => {
    if (!open) return;
    const fields = initialFields(mode, replyTo, mailboxAddress, initialTo);
    setTo(fields.to);
    setCc(fields.cc);
    if (fields.cc) setShowCc(true);
    setSubject(fields.subject);
    setBody(fields.body);
    setBodyHtml(plainTextToComposeHtml(fields.body));
    if (mode === "reply" || mode === "reply-all") {
      quotePlainRef.current = replyTo ? quoteOriginal(replyTo) : "";
    } else if (mode === "forward") {
      quotePlainRef.current = replyTo ? buildForwardedBody(replyTo) : "";
    } else {
      quotePlainRef.current = "";
    }
    setSendFromAccountId(accountId);
    setAttachments([]);
    setError(null);
    setMinimized(false);
  }, [open, mode, replyTo, mailboxAddress, initialTo, accountId]);

  useEffect(() => {
    if (open) setSendFromAccountId(accountId);
  }, [open, accountId]);

  function handleClose() {
    setOpen(false);
    setMinimized(false);
    setMaximized(false);
    onClose?.();
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingAttachment(true);
    setError(null);
    try {
      const added: ComposeAttachmentMeta[] = [];
      for (const file of Array.from(files)) {
        added.push(await uploadComposeAttachment(file));
      }
      setAttachments((prev) => [...prev, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function applyAiDraft(result: { subject: string; html: string }) {
    if (result.subject.trim() && !subject.trim()) {
      setSubject(result.subject.trim());
    }
    const quoteHtml =
      quotePlainRef.current.trim().length > 0
        ? plainTextToComposeHtml(`\n\n${quotePlainRef.current}`)
        : "";
    const signatureHtml = mode === "new" ? getDefaultEmailSignatureHtml() : "";
    const mergedHtml = `${result.html}${signatureHtml}${quoteHtml}`;
    setBodyHtml(mergedHtml);
    setBody(stripHtmlToPlain(mergedHtml));
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const sentMail = await sendEmail({
        accountId: sendFromAccountId,
        to: to.split(",").map((e) => e.trim()).filter(Boolean),
        cc: cc.split(",").map((e) => e.trim()).filter(Boolean),
        subject,
        body,
        bodyHtml,
        attachments: attachments.map((a) => ({ url: a.url, name: a.name, mime: a.mime })),
        inReplyTo: mode === "reply" || mode === "reply-all" ? replyTo?.rfcMessageId : undefined,
        references: mode === "reply" || mode === "reply-all" ? replyTo?.rfcMessageId : undefined,
      });
      setOpen(false);
      onSent?.(sentMail);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const needsSource = mode !== "new";
  const sourceReady =
    !needsSource ||
    Boolean(replyTo?.fromEmail && (replyTo.bodyText || replyTo.bodyHtml || replyTo.subject));

  const composerTitle =
    mode === "reply"
      ? "Reply"
      : mode === "reply-all"
      ? "Reply all"
      : mode === "forward"
      ? "Forward"
      : "New message";

  const composerNode =
    open && mounted ? (
      minimized ? (
        /* Minimized Docked Tab (Google Mail style) */
        <div
          className="fixed bottom-0 right-3 sm:right-6 z-50 flex h-10 w-72 sm:w-80 items-center justify-between rounded-t-xl border border-border/80 bg-card/95 px-3.5 shadow-2xl backdrop-blur-md cursor-pointer select-none transition-all hover:bg-muted/80 text-foreground"
          onClick={() => setMinimized(false)}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="truncate text-xs font-semibold">
              {subject.trim() || composerTitle}
            </span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setMinimized(false)}
              title="Expand"
              aria-label="Expand compose"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
              title="Close"
              aria-label="Close compose"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* Full Docked Compose Window (Google Mail style) */
        <div
          className={cn(
            "fixed z-50 flex flex-col border border-border/80 bg-card shadow-2xl transition-all duration-150 overflow-hidden text-foreground",
            maximized
              ? "bottom-2 right-2 sm:right-6 left-2 sm:left-auto w-[min(calc(100vw-1rem),960px)] h-[min(92vh,840px)] rounded-xl"
              : "bottom-0 right-2 sm:right-6 left-2 sm:left-auto w-[min(calc(100vw-1rem),640px)] h-[min(82vh,660px)] rounded-t-xl"
          )}
        >
          {/* Header Bar */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-muted/80 px-3.5 backdrop-blur-md select-none">
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-foreground">{composerTitle}</span>
              {subject && (
                <span className="text-xs text-muted-foreground truncate">— {subject}</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setMinimized(true)}
                title="Minimize"
                aria-label="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setMaximized(!maximized)}
                title={maximized ? "Restore size" : "Full screen"}
                aria-label={maximized ? "Restore size" : "Full screen"}
              >
                {maximized ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleClose}
                title="Save & close"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-4 py-3 space-y-2.5 bg-card [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80">
            {needsSource && !sourceReady && (
              <p className="text-sm text-muted-foreground">Loading message… ready in a moment.</p>
            )}

            {/* Send as Account Selector */}
            {accounts.length > 1 && (
              <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs">
                <span className="w-12 shrink-0 font-medium text-muted-foreground">From</span>
                <div className="flex-1 min-w-0">
                  <Select value={sendFromAccountId} onValueChange={setSendFromAccountId}>
                    <SelectTrigger className="h-7 w-full border-0 bg-transparent px-1 text-xs shadow-none hover:bg-muted/40 focus:ring-0">
                      <SelectValue placeholder="Choose mailbox" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.label} ({a.username})
                          {a.accessKind && a.accessKind !== "owner"
                            ? ` — ${a.accessKind === "delegate" ? "delegated" : "team"}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {sendFromAccount?.accessKind && sendFromAccount.accessKind !== "owner" && (
              <p className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                Sending on behalf of {sendFromAccount.ownerName ?? sendFromAccount.ownerEmail ?? "mailbox owner"}.
              </p>
            )}

            {/* Recipients (To) */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-1.5 text-xs">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">To</span>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com, …"
                className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
              />
              {!showCc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              )}
            </div>

            {/* CC Field */}
            {showCc && (
              <div className="flex items-center gap-2 border-b border-border/40 pb-1.5 text-xs">
                <span className="w-12 shrink-0 font-medium text-muted-foreground">Cc</span>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="colleague@example.com, …"
                  className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-1.5 text-xs">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">Subject</span>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of the email"
                className="h-7 border-0 bg-transparent px-1 text-xs font-medium shadow-none focus-visible:ring-0"
              />
            </div>

            {/* AI Assistant Writer */}
            <EmailAiWriter
              key={`ai-${open}-${initialAiPrompt}-${autoGenerateAi}`}
              defaultPrompt={initialAiPrompt}
              autoGenerate={autoGenerateAi && open}
              context={{
                composeMode: mode as MailboxComposeMode,
                to: to.trim() || initialTo?.trim() || "",
                subject,
                existingBodyPlain: stripHtmlToPlain(bodyHtml),
                threadFrom: replyTo?.fromEmail ?? replyTo?.fromName ?? undefined,
                threadSubject: replyTo?.subject ?? undefined,
                threadBodySnippet: replyTo ? emailPlainBody(replyTo).slice(0, 2500) : undefined,
              }}
              onGenerated={applyAiDraft}
            />

            {/* Message Body Editor */}
            <div className="flex-1 min-h-[160px] flex flex-col">
              <EmailComposeEditor
                content={bodyHtml}
                onChange={(html, plain) => {
                  setBodyHtml(html);
                  setBody(plain);
                }}
              />
            </div>

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Attachments ({attachments.length})
                </p>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {attachments.map((a) => (
                    <li
                      key={a.url}
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs shadow-2xs"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="max-w-[12rem] truncate">{a.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x.url !== a.url))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          {/* Action Footer (Google Mail style) */}
          <div className="flex shrink-0 items-center justify-between border-t border-border/60 bg-muted/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSend}
                disabled={
                  sending ||
                  uploadingAttachment ||
                  !to.trim() ||
                  !subject.trim() ||
                  (needsSource && !sourceReady)
                }
                className="gap-2 px-4 h-8 text-xs font-medium rounded-lg shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending…" : "Send"}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void onPickFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={uploadingAttachment}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                aria-label="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              {uploadingAttachment && (
                <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleClose}
              title="Discard draft"
              aria-label="Discard draft"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    ) : null;

  return (
    <div ref={ref} className="inline-block">
      {!headless && (
        <div
          onClick={(e) => {
            if ((trigger as any)?.props?.disabled) {
              e.preventDefault();
              return;
            }
            setOpen(true);
          }}
          className="inline-block w-full cursor-pointer"
        >
          {trigger ?? (
            <Button size="sm" className="w-full rounded-lg shadow-sm">
              Compose
            </Button>
          )}
        </div>
      )}
      {mounted && typeof document !== "undefined"
        ? createPortal(composerNode, document.body)
        : null}
    </div>
  );
});
