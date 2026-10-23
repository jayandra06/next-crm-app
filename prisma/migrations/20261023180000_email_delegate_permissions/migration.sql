CREATE TYPE "EmailDelegatePermission" AS ENUM ('READ_ONLY', 'SEND_ON_BEHALF', 'SEND_AS');

CREATE TABLE "EmailAccountDelegate" (
    "id" UUID NOT NULL,
    "emailAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" "EmailDelegatePermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAccountDelegate_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EmailAccountDelegate" ("id", "emailAccountId", "userId", "permission", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d."emailAccountId", d."userId", 'SEND_AS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ea."id" AS "emailAccountId", uid AS "userId"
  FROM "EmailAccount" ea
  CROSS JOIN LATERAL unnest(ea."delegateUserIds") AS uid
  WHERE EXISTS (SELECT 1 FROM "Users" u WHERE u."id" = uid)
) d;

CREATE UNIQUE INDEX "EmailAccountDelegate_emailAccountId_userId_key" ON "EmailAccountDelegate"("emailAccountId", "userId");
CREATE INDEX "EmailAccountDelegate_userId_idx" ON "EmailAccountDelegate"("userId");

ALTER TABLE "EmailAccountDelegate" ADD CONSTRAINT "EmailAccountDelegate_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAccountDelegate" ADD CONSTRAINT "EmailAccountDelegate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAccount" DROP COLUMN "delegateUserIds";
