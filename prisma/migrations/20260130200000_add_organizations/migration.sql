-- DropForeignKey
ALTER TABLE "Endorsement" DROP CONSTRAINT "Endorsement_userId_fkey";

-- AlterTable
ALTER TABLE "Endorsement" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_organizationId_policyId_key" ON "Endorsement"("organizationId", "policyId");

-- CreateIndex
CREATE INDEX "Policy_organizationId_idx" ON "Policy"("organizationId");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
