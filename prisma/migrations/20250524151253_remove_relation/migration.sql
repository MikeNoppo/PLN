/*
  Warnings:

  - You are about to drop the column `relatedPenyambunganReportId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `relatedUserId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `relatedYantekReportId` on the `ActivityLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedUserId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedYantekReportId_fkey";

-- DropIndex
DROP INDEX "ActivityLog_relatedPenyambunganReportId_idx";

-- DropIndex
DROP INDEX "ActivityLog_relatedUserId_idx";

-- DropIndex
DROP INDEX "ActivityLog_relatedYantekReportId_idx";

-- DropIndex
DROP INDEX "LaporanPenyambungan_id_idx";

-- DropIndex
DROP INDEX "LaporanYantek_id_idx";

-- AlterTable
ALTER TABLE "ActivityLog" DROP COLUMN "relatedPenyambunganReportId",
DROP COLUMN "relatedUserId",
DROP COLUMN "relatedYantekReportId",
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "createdPenyambunganReportId" TEXT,
ADD COLUMN     "createdYantekReportId" TEXT,
ADD COLUMN     "deletedReportId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_createdYantekReportId_idx" ON "ActivityLog"("createdYantekReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdPenyambunganReportId_idx" ON "ActivityLog"("createdPenyambunganReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdByUserId_idx" ON "ActivityLog"("createdByUserId");

-- CreateIndex
CREATE INDEX "LaporanPenyambungan_laporan_yante_id_idx" ON "LaporanPenyambungan"("laporan_yante_id");

-- CreateIndex
CREATE INDEX "LaporanYantek_status_laporan_idx" ON "LaporanYantek"("status_laporan");

-- CreateIndex
CREATE INDEX "LaporanYantek_createdAt_idx" ON "LaporanYantek"("createdAt");

-- CreateIndex
CREATE INDEX "Token_userId_idx" ON "Token"("userId");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
