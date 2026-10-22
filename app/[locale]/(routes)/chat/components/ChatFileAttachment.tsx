"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Film,
  FileCode,
  FileArchive,
  File as GenericFile,
  Download,
  Eye,
  X,
} from "lucide-react";
import type { ChatAttachmentItem } from "@/actions/chat/messages";
import { cn } from "@/lib/utils";

export type FileClassification = {
  type: "pdf" | "word" | "excel" | "powerpoint" | "image" | "video" | "archive" | "code" | "generic";
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string; // Tailwind color class for icon & text
  badgeBg: string;     // Tailwind background class
  borderColor: string; // Tailwind border class
};

export function classifyFile(name: string, mime?: string): FileClassification {
  const cleanName = (name || "").toLowerCase();
  const cleanMime = (mime || "").toLowerCase();

  // 1. PDF
  if (cleanName.endsWith(".pdf") || cleanMime.includes("pdf")) {
    return {
      type: "pdf",
      label: "PDF Document",
      badge: "PDF",
      icon: FileText,
      accentColor: "text-rose-600 dark:text-rose-400",
      badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
      borderColor: "border-rose-500/30 dark:border-rose-500/30",
    };
  }

  // 2. Word / Documents
  if (
    cleanName.endsWith(".doc") ||
    cleanName.endsWith(".docx") ||
    cleanName.endsWith(".rtf") ||
    cleanName.endsWith(".odt") ||
    cleanMime.includes("msword") ||
    cleanMime.includes("wordprocessingml")
  ) {
    const ext = cleanName.endsWith(".docx") ? "DOCX" : "DOC";
    return {
      type: "word",
      label: "Word Document",
      badge: ext,
      icon: FileText,
      accentColor: "text-blue-600 dark:text-blue-400",
      badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
      borderColor: "border-blue-500/30 dark:border-blue-500/30",
    };
  }

  // 3. Excel / Spreadsheets / CSV
  if (
    cleanName.endsWith(".xlsx") ||
    cleanName.endsWith(".xls") ||
    cleanName.endsWith(".csv") ||
    cleanName.endsWith(".tsv") ||
    cleanName.endsWith(".ods") ||
    cleanMime.includes("spreadsheet") ||
    cleanMime.includes("excel") ||
    cleanMime.includes("csv")
  ) {
    const isCsv = cleanName.endsWith(".csv");
    return {
      type: "excel",
      label: isCsv ? "CSV Spreadsheet" : "Excel Spreadsheet",
      badge: isCsv ? "CSV" : "XLS",
      icon: FileSpreadsheet,
      accentColor: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      borderColor: "border-emerald-500/30 dark:border-emerald-500/30",
    };
  }

  // 4. PowerPoint / Presentations
  if (
    cleanName.endsWith(".ppt") ||
    cleanName.endsWith(".pptx") ||
    cleanName.endsWith(".odp") ||
    cleanMime.includes("presentation") ||
    cleanMime.includes("powerpoint")
  ) {
    return {
      type: "powerpoint",
      label: "Presentation",
      badge: "PPT",
      icon: FileText,
      accentColor: "text-amber-600 dark:text-amber-400",
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
      borderColor: "border-amber-500/30 dark:border-amber-500/30",
    };
  }

  // 5. Images
  if (
    cleanName.endsWith(".png") ||
    cleanName.endsWith(".jpg") ||
    cleanName.endsWith(".jpeg") ||
    cleanName.endsWith(".gif") ||
    cleanName.endsWith(".webp") ||
    cleanName.endsWith(".svg") ||
    cleanMime.startsWith("image/")
  ) {
    return {
      type: "image",
      label: "Image",
      badge: "IMG",
      icon: ImageIcon,
      accentColor: "text-purple-600 dark:text-purple-400",
      badgeBg: "bg-purple-500/10 dark:bg-purple-500/20",
      borderColor: "border-purple-500/30 dark:border-purple-500/30",
    };
  }

  // 6. Videos
  if (
    cleanName.endsWith(".mp4") ||
    cleanName.endsWith(".mov") ||
    cleanName.endsWith(".webm") ||
    cleanMime.startsWith("video/")
  ) {
    return {
      type: "video",
      label: "Video",
      badge: "VID",
      icon: Film,
      accentColor: "text-indigo-600 dark:text-indigo-400",
      badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      borderColor: "border-indigo-500/30 dark:border-indigo-500/30",
    };
  }

  // 7. Archives
  if (
    cleanName.endsWith(".zip") ||
    cleanName.endsWith(".rar") ||
    cleanName.endsWith(".7z") ||
    cleanName.endsWith(".tar") ||
    cleanName.endsWith(".gz") ||
    cleanMime.includes("zip") ||
    cleanMime.includes("compressed")
  ) {
    return {
      type: "archive",
      label: "Archive",
      badge: "ZIP",
      icon: FileArchive,
      accentColor: "text-zinc-600 dark:text-zinc-400",
      badgeBg: "bg-zinc-500/10 dark:bg-zinc-500/20",
      borderColor: "border-zinc-500/30 dark:border-zinc-500/30",
    };
  }

  // 8. Code / Scripts
  if (
    cleanName.endsWith(".ts") ||
    cleanName.endsWith(".tsx") ||
    cleanName.endsWith(".js") ||
    cleanName.endsWith(".jsx") ||
    cleanName.endsWith(".json") ||
    cleanName.endsWith(".html") ||
    cleanName.endsWith(".css") ||
    cleanName.endsWith(".py") ||
    cleanName.endsWith(".sql")
  ) {
    return {
      type: "code",
      label: "Code File",
      badge: "CODE",
      icon: FileCode,
      accentColor: "text-cyan-600 dark:text-cyan-400",
      badgeBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
      borderColor: "border-cyan-500/30 dark:border-cyan-500/30",
    };
  }

  // 9. Generic File
  return {
    type: "generic",
    label: "Document",
    badge: "FILE",
    icon: GenericFile,
    accentColor: "text-slate-600 dark:text-slate-400",
    badgeBg: "bg-slate-500/10 dark:bg-slate-500/20",
    borderColor: "border-slate-500/30 dark:border-slate-500/30",
  };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ChatFileAttachmentProps = {
  file: ChatAttachmentItem;
  mine?: boolean;
  onPreview?: (file: ChatAttachmentItem) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function ChatFileAttachment({
  file,
  mine = false,
  onPreview,
  onRemove,
  compact = false,
}: ChatFileAttachmentProps) {
  const meta = classifyFile(file.name, file.mime);
  const Icon = meta.icon;
  const sizeStr = formatFileSize(file.size);

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking a direct button inside, let the button handle it
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (onPreview) {
      e.preventDefault();
      onPreview(file);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compact mode for pending attachments in composer
  if (compact) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs shadow-xs transition-colors",
          "border-border/70 bg-background text-foreground hover:border-border"
        )}
      >
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
            meta.badgeBg,
            meta.accentColor,
            meta.borderColor
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="max-w-[150px] truncate font-medium text-foreground" title={file.name}>
          {file.name}
        </span>
        {sizeStr && <span className="text-[10px] text-muted-foreground">({sizeStr})</span>}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Full rectangular card for chat messages
  return (
    <div
      onClick={handleCardClick}
      role={onPreview ? "button" : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onKeyDown={(e) => {
        if (onPreview && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPreview(file);
        }
      }}
      className={cn(
        "group relative flex w-full max-w-sm sm:max-w-md items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 select-none",
        mine
          ? "border-primary-foreground/20 bg-background/95 text-foreground hover:border-primary-foreground/40 shadow-xs"
          : "border-border/80 bg-background text-foreground hover:border-border shadow-xs",
        onPreview && "cursor-pointer hover:shadow-md"
      )}
    >
      {/* Rectangular Badge on Left */}
      <div
        className={cn(
          "relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border font-bold transition-transform group-hover:scale-105",
          meta.badgeBg,
          meta.accentColor,
          meta.borderColor
        )}
      >
        <Icon className="h-6 w-6 stroke-[2.2]" />
        <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider leading-none">
          {meta.badge}
        </span>
      </div>

      {/* Middle: File Name & Type info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-xs sm:text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{meta.label}</span>
          {sizeStr && (
            <>
              <span>·</span>
              <span>{sizeStr}</span>
            </>
          )}
        </p>
      </div>

      {/* Right: Actions (Preview & Download) */}
      <div className="flex shrink-0 items-center gap-1">
        {onPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(file);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Preview document"
            aria-label="Preview document"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Download file"
          aria-label="Download file"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
