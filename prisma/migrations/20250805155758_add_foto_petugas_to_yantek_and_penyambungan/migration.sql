/*
  Warnings:

  - You are about to drop the column `relatedPenyambunganReportId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `relatedUserId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `relatedYantekReportId` on the `ActivityLog` table. All the data in the column will be lost.
  - Added the required column `foto_petugas` to the `LaporanPenyambungan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foto_petugas` to the `LaporanYantek` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ActivityLog" DROP CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActivityLog" DROP CONSTRAINT "ActivityLog_relatedUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActivityLog" DROP CONSTRAINT "ActivityLog_relatedYantekReportId_fkey";

-- DropIndex
DROP INDEX "public"."ActivityLog_relatedPenyambunganReportId_idx";

-- DropIndex
DROP INDEX "public"."ActivityLog_relatedUserId_idx";

-- DropIndex
DROP INDEX "public"."ActivityLog_relatedYantekReportId_idx";

-- AlterTable
ALTER TABLE "public"."ActivityLog" DROP COLUMN "relatedPenyambunganReportId",
DROP COLUMN "relatedUserId",
DROP COLUMN "relatedYantekReportId",
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "createdPenyambunganReportId" TEXT,
ADD COLUMN     "createdYantekReportId" TEXT;

-- AlterTable
ALTER TABLE "public"."LaporanPenyambungan" ADD COLUMN     "foto_petugas" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."LaporanYantek" ADD COLUMN     "foto_petugas" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ActivityLog_createdYantekReportId_idx" ON "public"."ActivityLog"("createdYantekReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdPenyambunganReportId_idx" ON "public"."ActivityLog"("createdPenyambunganReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdByUserId_idx" ON "public"."ActivityLog"("createdByUserId");
