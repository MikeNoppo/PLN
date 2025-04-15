-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('REPORT_CREATED', 'REPORT_UPDATED', 'REPORT_DELETED', 'REPORT_COMPLETED', 'REPORT_PROCESSED');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "relatedYantekReportId" TEXT,
    "relatedPenyambunganReportId" TEXT,
    "relatedUserId" TEXT,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_id_key" ON "ActivityLog"("id");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedYantekReportId_fkey" FOREIGN KEY ("relatedYantekReportId") REFERENCES "LaporanYantek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_relatedPenyambunganReportId_fkey" FOREIGN KEY ("relatedPenyambunganReportId") REFERENCES "LaporanPenyambungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
