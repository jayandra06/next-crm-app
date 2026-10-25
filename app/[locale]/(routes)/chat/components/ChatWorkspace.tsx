"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { CheckCheck, ChevronLeft, Loader2, Paperclip, SendHorizontal, Users, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  sendChatMessage,
  type ChatAttachmentItem,
} from "@/actions/chat/messages";
import {
  chatMessagesKey,
  useAppendChatMessage,
  useChatMessagesLive,
} from "@/hooks/use-chat-messages-live";
import { useQueryClient } from "@tanstack/react-query";
import { openJitsiMeetInNewTab } from "@/components/meet/JitsiMeetEmbed";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markChatRoomRead } from "@/actions/chat/unread";
import { avatarGradientClass, initials } from "@/lib/chat/avatar-style";
import { uploadChatFile } from "@/lib/chat/upload-file";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { ChatFileAttachment } from "./ChatFileAttachment";

const ChatFilePreviewModal = dynamic(
  () => import("./ChatFilePreviewModal").then((m) => m.ChatFilePreviewModal),
  { ssr: false }
);

type Props = {
  roomKey: string;
  roomTitle: string;
  displayName: string;
  meetRoom: string;
  currentUserId: string;
  initialCallOpen?: boolean;
  initialDraft?: string;
  isGeneral?: boolean;
  peerName?: string;
  peerDetail?: string;
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

function usePhoneLayout() {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return phone;
}

function senderColor(id: string) {
  const colors = ["text-[#e542a3]", "text-[#1f7aec]", "text-[#0b8466]", "text-[#c4531b]", "text-[#7f66ff]"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 9973;
  return colors[h % colors.length];
}

function plainToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function ChatWorkspace({
  roomKey,
  roomTitle,
  displayName,
  meetRoom,
  currentUserId,
  initialCallOpen = false,
  initialDraft,
  isGeneral = false,
  peerName,
  peerDetail,
}: Props) {
  const qc = useQueryClient();
  const { data: messages = [] } = useChatMessagesLive(roomKey);
  const appendMessage = useAppendChatMessage(roomKey);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pendingFiles, setPendingFiles] = React.useState<ChatAttachmentItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgressText, setUploadProgressText] = React.useState<string | null>(null);
  const [meetHint, setMeetHint] = React.useState(initialCallOpen);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = React.useState<ChatAttachmentItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const appliedDraftRef = React.useRef<string | null>(null);

  const handleOpenPreview = (file: ChatAttachmentItem) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  React.useEffect(() => {
    setMeetHint(initialCallOpen);
    setPendingFiles([]);
    setUploadProgressText(null);
    if (initialDraft?.trim() && appliedDraftRef.current !== `${roomKey}:${initialDraft}`) {
      appliedDraftRef.current = `${roomKey}:${initialDraft}`;
      setDraft(initialDraft.trim());
    } else if (!initialDraft?.trim()) {
      setDraft("");
    }
  }, [initialCallOpen, roomKey, initialDraft]);

  React.useEffect(() => {
    void markChatRoomRead(roomKey);
  }, [roomKey, messages.length]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, roomKey]);

  React.useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  function joinMeeting() {
    openJitsiMeetInNewTab(meetRoom, displayName);
    setMeetHint(true);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(
        roomKey,
        text ? plainToHtml(text) : "<p></p>",
        pendingFiles
      );
      appendMessage(msg);
      void qc.invalidateQueries({ queryKey: chatMessagesKey(roomKey) });
      void qc.invalidateQueries({ queryKey: ["live-summary"] });
      setDraft("");
      setPendingFiles([]);
      void markChatRoomRead(roomKey);
    } catch (err) {
      console.error("[handleSend] Failed to send message:", err);
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  async function onPickFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    setUploading(true);
    try {
      const uploadedItems: ChatAttachmentItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setUploadProgressText(`Uploading ${i + 1} of ${files.length}: ${f.name}...`);
        const result = await uploadChatFile(f);
        uploadedItems.push({
          url: result.url,
          name: result.name,
          mime: result.mime,
          size: f.size,
        });
      }
      setPendingFiles((prev) => [...prev, ...uploadedItems]);
    } catch (e) {
      console.error("[onPickFiles] Upload failed:", e);
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgressText(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const subtitle = isGeneral ? "Team channel" : peerDetail || "Direct message";
  const coarse = usePhoneLayout();

  let lastDay: string | null = null;
  const canSend = !sending && !uploading && (draft.trim().length > 0 || pendingFiles.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#efeae2] dark:bg-[#0b141a]">
      <header className="flex shrink-0 items-center gap-1 border-b border-black/5 bg-[#f0f2f5] px-1 py-1.5 dark:border-white/10 dark:bg-[#202c33] sm:px-3">
        <Link
          href="/chat"
          aria-label="Back to chats"
          className="-ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 md:hidden dark:text-[#aebac1]"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1">
          {isGeneral ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white">
              <Users className="h-5 w-5" />
            </span>
          ) : (
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                avatarGradientClass(roomKey)
              )}
            >
              {initials(roomTitle)}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-[#111b21] dark:text-[#e9edef]">{roomTitle}</h2>
            <p className="truncate text-[12px] text-[#667781] dark:text-[#8696a0]">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 dark:text-[#aebac1]"
          onClick={joinMeeting}
          aria-label="Start meeting"
          title="Start meeting"
        >
          <Video className="h-5 w-5" />
        </button>
      </header>

      {meetHint && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#fff9e6] px-3 py-2 text-xs text-[#54656f] dark:bg-[#182229] dark:text-[#8696a0]">
          <p>Meeting opens in a new window. This chat stays open.</p>
          <button
            type="button"
            className="shrink-0 font-medium underline-offset-2 hover:underline"
            onClick={() => setMeetHint(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      <ScrollArea className="chat-wallpaper min-h-0 flex-1">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-3 py-3 sm:px-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <p className="max-w-[260px] rounded-lg bg-[#fff9e6] px-3 py-2 text-center text-[12.5px] leading-snug text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                {isGeneral
                  ? "This is the start of the team channel. Say hello."
                  : `This is the start of your conversation with ${peerName ?? roomTitle}.`}
              </p>
            </div>
          ) : (
            messages.map((m, index) => {
              const mine = m.user.id === currentUserId;
              const day = dayLabel(m.createdAt);
              const showDay = day !== lastDay;
              if (showDay) lastDay = day;

              const prev = index > 0 ? messages[index - 1] : null;
              const clustered =
                !showDay && prev?.user.id === m.user.id && dayLabel(prev.createdAt) === day;

              const atts = m.attachments?.length
                ? m.attachments
                : m.attachment
                  ? [m.attachment]
                  : [];

              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                        {day}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex", mine ? "justify-end" : "justify-start", clustered ? "mt-0.5" : "mt-1.5")}>
                    <div
                      className={cn(
                        "relative max-w-[min(82%,28rem)] px-2 pb-1 pt-1 shadow-sm",
                        mine
                          ? "rounded-lg rounded-br-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
                          : "rounded-lg rounded-bl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
                      )}
                    >
                      {isGeneral && !mine && !clustered && (
                        <p className={cn("px-0.5 text-[12.5px] font-semibold leading-tight", senderColor(m.user.id))}>
                          {m.user.name}
                        </p>
                      )}
                      {m.htmlBody ? (
                        <div
                          className="text-left text-[14.5px] leading-[19px] [&_a]:underline [&_p]:my-0"
                          dangerouslySetInnerHTML={{ __html: m.htmlBody }}
                        />
                      ) : m.body ? (
                        <p className="whitespace-pre-wrap text-left text-[14.5px] leading-[19px]">{m.body}</p>
                      ) : null}

                      {atts.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-1.5 text-left">
                          {atts.map((att, idx) => (
                            <ChatFileAttachment
                              key={`${att.url}-${idx}`}
                              file={att}
                              mine={mine}
                              onPreview={handleOpenPreview}
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center justify-end gap-0.5">
                        <span className="text-[10px] leading-none text-black/45 dark:text-white/55">
                          {format(new Date(m.createdAt), "h:mm a")}
                        </span>
                        {mine && <CheckCheck className="h-3.5 w-3.5 text-black/40 dark:text-white/55" />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </ScrollArea>

      <div className="shrink-0 bg-[#efeae2] px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] dark:bg-[#0b141a] sm:px-3">
        <div className="mx-auto w-full max-w-3xl">
          {pendingFiles.length > 0 && (
            <div className="mb-1.5 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl bg-white/80 p-1.5 dark:bg-[#202c33]">
              {pendingFiles.map((f, idx) => (
                <ChatFileAttachment
                  key={`${f.url}-${idx}`}
                  file={f}
                  compact
                  onRemove={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}

          {uploading && (
            <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-medium text-[#54656f] animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a884]" />
              <span>{uploadProgressText || "Uploading files..."}</span>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip,.rar"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <div className="flex min-h-[46px] flex-1 items-end rounded-3xl bg-white px-1.5 py-1 dark:bg-[#2a3942]">
              <button
                type="button"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] disabled:opacity-40 dark:text-[#8696a0]"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                aria-label="Attach files"
              >
                <Paperclip className="h-[18px] w-[18px]" />
              </button>
              <textarea
                ref={composerRef}
                value={draft}
                rows={1}
                placeholder="Message"
                className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-5 text-[#111b21] outline-none placeholder:text-[#667781] dark:text-[#e9edef]"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !coarse) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-40"
              disabled={!canSend}
              onClick={() => void handleSend()}
              title="Send"
              aria-label="Send"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 hidden px-1 text-[11px] text-[#667781] md:block">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>

      {/* In-page Document / PDF / File Preview Modal */}
      <ChatFilePreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
