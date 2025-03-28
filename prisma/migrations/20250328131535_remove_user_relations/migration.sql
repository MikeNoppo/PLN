/*
  Warnings:

  - You are about to drop the `DeletedUsers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LaporanPenyambungan" DROP CONSTRAINT "LaporanPenyambungan_nama_petugas_fkey";

-- DropForeignKey
ALTER TABLE "LaporanYantek" DROP CONSTRAINT "LaporanYantek_nama_petugas_fkey";

-- DropTable
DROP TABLE "DeletedUsers";
