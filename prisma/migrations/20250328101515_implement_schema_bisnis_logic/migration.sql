-- CreateEnum
CREATE TYPE "StatusLaporan" AS ENUM ('BARU', 'DIPROSES', 'SELESAI');

-- CreateEnum
CREATE TYPE "TipeMeter" AS ENUM ('PASCA_BAYAR', 'PRA_BAYAR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PETUGAS_YANTEK', 'PETUGAS_PENYAMBUNGAN');

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL,
    "lastOnline" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaporanYantek" (
    "id" TEXT NOT NULL,
    "ID_Pelanggan" TEXT NOT NULL,
    "nomor_meter" TEXT NOT NULL,
    "tipe_meter" "TipeMeter" NOT NULL,
    "no_telepon_pelanggan" TEXT NOT NULL,
    "nama_petugas" TEXT NOT NULL,
    "foto_rumah" TEXT NOT NULL,
    "foto_meter_rusak" TEXT NOT NULL,
    "stand_meter_cabut" TEXT,
    "sisa_pulsa" TEXT,
    "foto_ba_gangguan" TEXT NOT NULL,
    "titik_koordinat" TEXT NOT NULL,
    "status_laporan" "StatusLaporan" NOT NULL DEFAULT 'BARU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaporanYantek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaporanPenyambungan" (
    "id" TEXT NOT NULL,
    "laporan_yante_id" TEXT NOT NULL,
    "foto_pemasangan_meter" TEXT NOT NULL,
    "foto_rumah_pelanggan" TEXT NOT NULL,
    "foto_ba_pemasangan" TEXT NOT NULL,
    "nama_petugas" TEXT NOT NULL,
    "status_laporan" "StatusLaporan" NOT NULL DEFAULT 'DIPROSES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaporanPenyambungan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_token_key" ON "Token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LaporanYantek_ID_Pelanggan_key" ON "LaporanYantek"("ID_Pelanggan");

-- CreateIndex
CREATE UNIQUE INDEX "LaporanPenyambungan_laporan_yante_id_key" ON "LaporanPenyambungan"("laporan_yante_id");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaporanYantek" ADD CONSTRAINT "LaporanYantek_nama_petugas_fkey" FOREIGN KEY ("nama_petugas") REFERENCES "User"("name") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaporanPenyambungan" ADD CONSTRAINT "LaporanPenyambungan_nama_petugas_fkey" FOREIGN KEY ("nama_petugas") REFERENCES "User"("name") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaporanPenyambungan" ADD CONSTRAINT "LaporanPenyambungan_laporan_yante_id_fkey" FOREIGN KEY ("laporan_yante_id") REFERENCES "LaporanYantek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
