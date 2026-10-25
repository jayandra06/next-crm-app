-- Per-mailbox email signature text and optional image.
ALTER TABLE "EmailAccount" ADD COLUMN "signatureText" TEXT;
ALTER TABLE "EmailAccount" ADD COLUMN "signatureImageUrl" TEXT;
