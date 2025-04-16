-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_relatedYantekReportId_fkey";

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedYantekReportId_fkey" FOREIGN KEY ("relatedYantekReportId") REFERENCES "LaporanYantek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey" FOREIGN KEY ("relatedPenyambunganReportId") REFERENCES "LaporanPenyambungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
