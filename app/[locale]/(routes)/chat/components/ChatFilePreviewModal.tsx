"use client";

import * as React from "react";
import {
  Download,
  ExternalLink,
  X,
  FileText,
  AlertCircle,
} from "lucide-react";
import type { ChatAttachmentItem } from "@/actions/chat/messages";
import { classifyFile, formatFileSize } from "./ChatFileAttachment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  file: ChatAttachmentItem | null;
  isOpen: boolean;
  onClose: () => void;
};

export function ChatFilePreviewModal({ file, isOpen, onClose }: Props) {
  const [loadError, setLoadError] = React.useState(false);
  const [docViewerType, setDocViewerType] = React.useState<"office" | "google">("office");

  React.useEffect(() => {
    setLoadError(false);
    setDocViewerType("office");
  }, [file?.url]);

  if (!file) return null;

  const meta = classifyFile(file.name, file.mime);
  const Icon = meta.icon;
  const sizeStr = formatFileSize(file.size);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenOriginal = () => {
    window.open(file.url, "_blank", "noopener,noreferrer");
  };

  const isPdf = meta.type === "pdf";
  const isImage = meta.type === "image";
  const isVideo = meta.type === "video";
  const isOfficeDoc = meta.type === "word" || meta.type === "excel" || meta.type === "powerpoint";

  const officeEmbedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
  const googleEmbedUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-5xl w-[95vw] h-[88vh] max-h-[850px] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-2xl border-border/80 shadow-2xl bg-background"
        aria-describedby="file-preview-description"
      >
        {/* Top Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3 sm:px-6 bg-muted/30">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border font-bold",
                meta.badgeBg,
                meta.accentColor,
                meta.borderColor
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5">
                {meta.badge}
              </span>
            </div>

            <div className="min-w-0">
              <DialogTitle className="truncate text-sm sm:text-base font-semibold leading-tight text-foreground max-w-xs sm:max-w-md md:max-w-lg">
                {file.name}
              </DialogTitle>
              <DialogDescription id="file-preview-description" className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{meta.label}</span>
                {sizeStr && <span>· {sizeStr}</span>}
              </DialogDescription>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pr-6 sm:pr-8">
            {isOfficeDoc && (
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDocViewerType("office")}
                  className={cn(
                    "rounded px-2 py-1 font-medium transition-colors",
                    docViewerType === "office"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Office View
                </button>
                <button
                  type="button"
                  onClick={() => setDocViewerType("google")}
                  className={cn(
                    "rounded px-2 py-1 font-medium transition-colors",
                    docViewerType === "google"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Google View
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenOriginal}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Open in new window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Download file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </Button>
          </div>
        </div>

        {/* Preview Content Area */}
        <div className="flex-1 min-h-0 bg-muted/20 relative flex items-center justify-center overflow-auto p-2 sm:p-4">
          {loadError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
              <AlertCircle className="h-12 w-12 text-destructive mb-3" />
              <p className="text-base font-semibold text-foreground">Preview unavailable</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                The file cannot be previewed directly inside the browser. You can download it to view on your device.
              </p>
              <Button type="button" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download {file.name}
              </Button>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`${file.url}#toolbar=1`}
                className="w-full h-full rounded-lg border border-border/80 bg-background shadow-xs"
                title={file.name}
                onError={() => setLoadError(true)}
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.name}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm border border-border/50 bg-background"
                onError={() => setLoadError(true)}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <video
                src={file.url}
                controls
                className="max-h-full max-w-full rounded-xl shadow-lg border border-border bg-black"
                onError={() => setLoadError(true)}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : isOfficeDoc ? (
            <div className="w-full h-full flex flex-col">
              <iframe
                key={docViewerType}
                src={docViewerType === "office" ? officeEmbedUrl : googleEmbedUrl}
                className="w-full h-full rounded-lg border border-border/80 bg-background shadow-xs"
                title={file.name}
                onError={() => setLoadError(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-background rounded-xl border border-border/70 shadow-sm">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-2xl border mb-4 font-bold",
                  meta.badgeBg,
                  meta.accentColor,
                  meta.borderColor
                )}
              >
                <Icon className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground truncate max-w-xs">{file.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {meta.label} {sizeStr && `· ${sizeStr}`}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mb-5">
                In-browser preview is best experienced by opening or downloading this document format directly.
              </p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={handleOpenOriginal} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </Button>
                <Button type="button" onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/70 px-4 py-2 text-xs text-muted-foreground bg-muted/20">
          <span>{meta.label}</span>
          <div className="flex items-center gap-2">
            <span>Click Download to save a local copy</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
