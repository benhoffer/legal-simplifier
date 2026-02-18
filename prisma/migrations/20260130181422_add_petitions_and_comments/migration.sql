-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_policyId_fkey";

-- DropForeignKey
ALTER TABLE "PetitionSignature" DROP CONSTRAINT "PetitionSignature_policyId_fkey";

-- DropIndex
DROP INDEX "PetitionSignature_userId_policyId_key";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "downvotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upvotes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PetitionSignature" DROP COLUMN "anonymous",
DROP COLUMN "comment",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fullName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "verificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PetitionSignature_verificationToken_key" ON "PetitionSignature"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "PetitionSignature_policyId_userId_key" ON "PetitionSignature"("policyId", "userId");

-- AddForeignKey
ALTER TABLE "PetitionSignature" ADD CONSTRAINT "PetitionSignature_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
