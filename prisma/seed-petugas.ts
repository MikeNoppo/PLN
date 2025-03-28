import { PrismaClient, UserRole, StatusLaporan, TipeMeter } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  console.log('Cleaning up existing data...');
  await prisma.laporanPenyambungan.deleteMany();
  await prisma.laporanYantek.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany({
    where: {
      role: {
        in: [UserRole.PETUGAS_YANTEK, UserRole.PETUGAS_PENYAMBUNGAN]
      }
    }
  });
  console.log('Database cleaned');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create 5 PETUGAS_YANTEK users
  const yantekUsers = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        username: `yantek${i}`,
        password: hashedPassword,
        name: `Petugas Yantek ${i}`,
        role: UserRole.PETUGAS_YANTEK,
      },
    });
    yantekUsers.push(user);
  }

  // Create 5 PETUGAS_PENYAMBUNGAN users
  const penyambunganUsers = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        username: `penyambungan${i}`,
        password: hashedPassword,
        name: `Petugas Penyambungan ${i}`,
        role: UserRole.PETUGAS_PENYAMBUNGAN,
      },
    });
    penyambunganUsers.push(user);
  }

  // Create 5 laporan yantek for each PETUGAS_YANTEK
  for (const user of yantekUsers) {
    for (let i = 1; i <= 5; i++) {
      const laporanYantek = await prisma.laporanYantek.create({
        data: {
          ID_Pelanggan: `PLG-${user.name}-${i}`,
          nomor_meter: `MTR-${Math.random().toString(36).substring(2, 10)}`,
          tipe_meter: i % 2 === 0 ? TipeMeter.PASCA_BAYAR : TipeMeter.PRA_BAYAR,
          no_telepon_pelanggan: `08${Math.floor(Math.random() * 999999999)}`,
          nama_petugas: user.name,
          foto_rumah: `rumah-${i}.jpg`,
          foto_meter_rusak: `meter-rusak-${i}.jpg`,
          stand_meter_cabut: i % 2 === 0 ? `${Math.floor(Math.random() * 9999)}` : null,
          sisa_pulsa: i % 2 === 1 ? `${Math.floor(Math.random() * 100000)}` : null,
          foto_ba_gangguan: `ba-gangguan-${i}.jpg`,
          titik_koordinat: `${(Math.random() * 90).toFixed(6)},${(Math.random() * 180).toFixed(6)}`,
          status_laporan: StatusLaporan.BARU,
        },
      });

      // Create corresponding laporan penyambungan
      await prisma.laporanPenyambungan.create({
        data: {
          laporan_yante_id: laporanYantek.id,
          foto_pemasangan_meter: `pemasangan-${i}.jpg`,
          foto_rumah_pelanggan: `rumah-pelanggan-${i}.jpg`,
          foto_ba_pemasangan: `ba-pemasangan-${i}.jpg`,
          nama_petugas: penyambunganUsers[Math.floor(Math.random() * penyambunganUsers.length)].name,
          status_laporan: StatusLaporan.DIPROSES,
        },
      });
    }
  }

  console.log('Seeding petugas data completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
