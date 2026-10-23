CREATE TABLE "DocLetterhead" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#1e3a5f',
    "contactLines" JSONB NOT NULL DEFAULT '[]',
    "pageWidth" DOUBLE PRECISION NOT NULL,
    "pageHeight" DOUBLE PRECISION NOT NULL,
    "headerHeight" DOUBLE PRECISION NOT NULL,
    "footerHeight" DOUBLE PRECISION NOT NULL,
    "sideMargin" DOUBLE PRECISION NOT NULL,
    "headerPng" BYTEA NOT NULL,
    "footerPng" BYTEA NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocLetterhead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocLetter" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "letterheadId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocLetterhead_createdById_idx" ON "DocLetterhead"("createdById");
CREATE INDEX "DocLetter_createdById_idx" ON "DocLetter"("createdById");
CREATE INDEX "DocLetter_letterheadId_idx" ON "DocLetter"("letterheadId");
CREATE INDEX "DocLetter_updatedAt_idx" ON "DocLetter"("updatedAt");

ALTER TABLE "DocLetterhead" ADD CONSTRAINT "DocLetterhead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocLetter" ADD CONSTRAINT "DocLetter_letterheadId_fkey" FOREIGN KEY ("letterheadId") REFERENCES "DocLetterhead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocLetter" ADD CONSTRAINT "DocLetter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
