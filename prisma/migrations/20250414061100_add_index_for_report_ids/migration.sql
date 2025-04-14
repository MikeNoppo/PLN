/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `LaporanYantek` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LaporanYantek_ID_Pelanggan_key";

-- CreateIndex
CREATE INDEX "LaporanPenyambungan_id_idx" ON "LaporanPenyambungan"("id");

-- CreateIndex
CREATE UNIQUE INDEX "LaporanYantek_id_key" ON "LaporanYantek"("id");

-- CreateIndex
CREATE INDEX "LaporanYantek_id_idx" ON "LaporanYantek"("id");
