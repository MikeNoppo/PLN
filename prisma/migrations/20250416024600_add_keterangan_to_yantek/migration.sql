-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedYantekReportId_fkey";

-- DropForeignKey
ALTER TABLE "LaporanPenyambungan" DROP CONSTRAINT "LaporanPenyambungan_laporan_yante_id_fkey";

-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_userId_fkey";

-- DropIndex
DROP INDEX "ActivityLog_id_key";

-- AlterTable
ALTER TABLE "LaporanYantek" ADD COLUMN     "keterangan" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityLog_relatedYantekReportId_idx" ON "ActivityLog"("relatedYantekReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_relatedPenyambunganReportId_idx" ON "ActivityLog"("relatedPenyambunganReportId");

-- CreateIndex
CREATE INDEX "ActivityLog_relatedUserId_idx" ON "ActivityLog"("relatedUserId");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaporanPenyambungan" ADD CONSTRAINT "LaporanPenyambungan_laporan_yante_id_fkey" FOREIGN KEY ("laporan_yante_id") REFERENCES "LaporanYantek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedYantekReportId_fkey" FOREIGN KEY ("relatedYantekReportId") REFERENCES "LaporanYantek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey" FOREIGN KEY ("relatedPenyambunganReportId") REFERENCES "LaporanPenyambungan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
