"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveMailboxSignature } from "@/actions/emails/signature";
import { buildEmailSignature } from "@/lib/email/signature";
import { uploadComposeAttachment } from "@/lib/email/upload-compose-attachment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function MailboxSignatureDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    label: string;
    username: string;
    fromName?: string | null;
    signatureText?: string | null;
    signatureImageUrl?: string | null;
  };
  onSaved: () => void;
}) {
  const [text, setText] = useState(account.signatureText ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(account.signatureImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const preview = buildEmailSignature({
    senderName: account.fromName || account.label,
    customText: text,
    imageUrl,
  });

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Signature image must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadComposeAttachment(file);
      setImageUrl(uploaded.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveMailboxSignature(account.id, { text, imageUrl });
      toast.success("Signature saved. It is added to mail sent from this mailbox.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save signature");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email signature</DialogTitle>
          <DialogDescription>
            {account.username}. The image and text below are added to every email sent from this
            mailbox. Leave the text empty to use the company lines. Leave the image empty to use the
            VenSai Labs logo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="signature-text">Signature text</Label>
          <Textarea
            id="signature-text"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Your name\nVenSai Labs\nPhone or title"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" disabled={uploading} asChild>
            <label>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {imageUrl ? "Replace image" : "Attach image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => void onPickImage(event.target.files?.[0])}
              />
            </label>
          </Button>
          {imageUrl && (
            <Button type="button" variant="ghost" onClick={() => setImageUrl(null)}>
              Use company logo
            </Button>
          )}
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
