# Daftar Tugas Pengembangan Backend Aplikasi Mobile PLN

## Desain Skema Basis Data
- [x] Buat skema Prisma untuk:
- User (dengan peran berbeda: Admin, Petugas Yantek, Petugas Penyambungan)
- Token
- Laporan Yantek
    - IDPEL
    - Nomor Meter
    - Tipe Meter
    - Nomor Telepon Pelanggan
    - Nama Petugas
    - Foto Rumah
    - Foto Meter Rusak
    - Stand Meter Cabut
    - Sisa Pulsa
    - Foto Bukti Acara Gangguan
    - Titik Koordinat
    - Status Laporan (@Default "BARU")
    - Relasi dengan User (Petugas Yantek)

- Laporan Penyambungan
    - ID (@default cuid)
    - Laporan Yantek ID (@unique)
    - Foto Pemasangan Meter
    - Foto Rumah Pelanggan
    - Foto BA Pemasangan
    - Nama Petugas
    - Status Laporan (@Default "DIPROSES")
    - Created At (@default now)
    - Relasi dengan Petugas
    - Relasi dengan Laporan Yantek

## Modul Autentikasi
- [x] Terapkan autentikasi berbasis JWT
- [x] Buat kontrol akses berbasis peran Admin
- [x] Kembangkan endpoint login untuk berbagai peran User
- [x] Terapkan enkripsi kata sandi
- [x] Buat endpoint manajemen User untuk admin

## Endpoint Pelaporan

### Pelaporan Petugas Yantek
- [ ] Buat endpoint untuk pelaporan kerusakan meter
- [ ] Terapkan unggahan file untuk:
  - Foto Rumah Pelanggan
  - Foto Meter Rusak
  - Foto Berita Acara Gangguan
- [ ] Validasi dan simpan detail laporan:
  - Nomor Meter
  - IDPEL
  - Nomor Telepon Pelanggan
  - Nama Petugas
  - Stand Meter
  - Sisa Pulsa

### Pelaporan Petugas Penyambungan
- [ ] Buat endpoint untuk pelaporan pemasangan meter
- [ ] Terapkan unggahan file untuk:
  - Foto Pemasangan Meter
  - Foto Rumah Pelanggan
  - Foto Berita Acara Pemasangan
- [ ] Validasi dan simpan detail laporan perbaikan

## Endpoint Manajemen Laporan
- [ ] Kembangkan endpoint untuk:
  - Mengambil semua laporan
  - Penyaringan laporan
  - Memperbarui status laporan
  - Penetapan tugas perbaikan

## Fungsionalitas Ekspor
- [ ] Buat endpoint untuk ekspor laporan
- [ ] Terapkan filter ekspor:
  - Tahun
  - Tipe Meter
  - Bulan
  - Petugas
- [ ] Hasilkan ekspor Excel/PDF dengan urutan kolom spesifik:
  1. IDPEL
  2. Nomor Meter
  3. Tanggal Pelaporan Yantek
  4. Tanggal Pelaporan Penyambungan
  5. Nama Petugas Yantek
  6. Nama Petugas Penyambungan
  7. Foto-foto
  8. Status Laporan

## Endpoint Data Dasbor
- [ ] Buat endpoint untuk statistik dasboard
- [ ] Terapkan pengambilan data pie chart:
  - Status meter (Rusak vs Diperbaiki)
  - Tipe meter (Pasca Bayar vs Pra Bayar)

## Endpoint Hak Akses dan Pengeditan

### Hak Akses Admin
- [x] Buat endpoint users management
    - menghapus akun user petugas 
    - membuat akun user petugas
- [ ] Buat endpoint untuk:
  - Mengedit laporan
  - Mengelola akun User
  - Memperbarui informasi pelanggan
  - Memodifikasi foto

### Hak Akses Petugas
- [ ] Buat endpoint untuk mengedit:
  - Foto laporan sendiri
  - Nomor telepon
  - IDPEL

## Keamanan dan Validasi
- [ ] Terapkan validasi input untuk semua endpoint
- [ ] Tambahkan Rate Limiter
- [ ] Terapkan penanganan kesalahan yang tepat
- [ ] Pastikan mekanisme unggahan file aman
- [ ] Tambahkan pencatatan untuk operasi kritis

## Kinerja dan Optimasi
- [ ] Terapkan pengindeksan basis data
- [ ] Optimalkan kueri basis data
- [ ] Tambahkan mekanisme caching untuk data yang sering diakses

## Integrasi dan Kompatibilitas
- [ ] Pastikan backend mendukung persyaratan aplikasi mobile
- [ ] Buat dokumentasi API komprehensif
- [ ] Terapkan versi API

## Pengujian
- [ ] Uji unit untuk setiap endpoint
- [ ] Uji integrasi
- [ ] Pengujian kerentanan keamanan
- [ ] Pengujian performa

## Persiapan Deployment
- [ ] Konfigurasikan lingkungan produksi
- [ ] Siapkan integrasi berkelanjutan (CI)
- [ ] Siapkan skrip deployment
- [ ] Konfigurasikan variabel lingkungan
