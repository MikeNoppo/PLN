-- DropIndex
DROP INDEX "LaporanPenyambungan_id_idx";

-- DropIndex
DROP INDEX "LaporanYantek_id_idx";

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "deletedReportId" TEXT;

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
