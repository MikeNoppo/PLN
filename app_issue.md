# Rencana Perbaikan Logika Bisnis - Laporan Gangguan Meter PLN

## Masalah yang Ditemukan
1.  Database saat ini memiliki `@unique` constraint pada field `ID_Pelanggan` di model `LaporanYantek`.
2.  Jika pelanggan yang sama mengalami gangguan meter setelah laporan sebelumnya selesai, tidak bisa membuat laporan baru.
3.  Error yang muncul: `P2002 Unique constraint failed on the fields: (ID_Pelanggan)`.

## Alur Bisnis yang Diharapkan
1.  Petugas Yantek membuat laporan gangguan meter (`LaporanYantek`).
2.  Status awal laporan adalah `BARU`.
3.  Petugas Penyambungan mengirimkan laporan penyambungan (`LaporanPenyambungan`).
4.  Status laporan menjadi `SELESAI`.
5.  Jika terjadi gangguan lagi di kemudian hari, petugas Yantek harus bisa membuat laporan baru.

## Solusi yang Diusulkan

### 1. Perubahan Schema Database
```prisma
model LaporanYantek {
  id                String       @id @default(cuid())
  ID_Pelanggan     String       // Hapus @unique constraint
  // ... field lainnya ...
  status_laporan   StatusLaporan @default(BARU)
  createdAt        DateTime     @default(now())
  
  laporan_penyambungan LaporanPenyambungan?
}
```

### 2. Langkah-langkah Implementasi
1.  Modifikasi `prisma/schema.prisma`:
    - Hapus `@unique` constraint dari field `ID_Pelanggan`
    - Generate dan jalankan migrasi database

2.  Review dan Update Kode:
    - Periksa `reports.service.ts` untuk memastikan penanganan multiple laporan per pelanggan
    - Update method `findOne` dan `findAll` jika perlu (misal: tambah sorting by `createdAt`)
    - Hapus error handling khusus untuk `P2002` (duplicate ID)

3.  Tambahan Validasi yang Mungkin Diperlukan:
    - Cek apakah pelanggan memiliki laporan aktif (`BARU` atau `DIPROSES`)
    - Jika ada, berikan pesan error yang jelas
    - Jika tidak ada atau semua laporan `SELESAI`, izinkan pembuatan laporan baru

### 3. Query untuk Validasi (Contoh)
```typescript
// Cek laporan aktif
const existingActiveReport = await prisma.laporanYantek.findFirst({
  where: {
    ID_Pelanggan: newReport.ID_Pelanggan,
    status_laporan: {
      in: ['BARU', 'DIPROSES']
    }
  }
});

if (existingActiveReport) {
  throw new ConflictException(
    'Pelanggan ini masih memiliki laporan yang sedang diproses'
  );
}
```

## Status
- [x] Identifikasi masalah
- [x] Analisis solusi
- [ ] Persetujuan manager
- [ ] Implementasi
- [ ] Testing
- [ ] Deployment

## Catatan
* Perlu diskusi dengan manager untuk memastikan solusi ini sesuai dengan kebutuhan bisnis.
* Perlu mempertimbangkan dampak ke fitur lain yang mungkin bergantung pada unique constraint ID_Pelanggan.
* Perlu memastikan UI/mobile app siap menangani multiple laporan per pelanggan.

---

# Isu Ekspor Excel: Penyematan Gambar vs Hyperlink

## Masalah yang Ditemukan
Saat ini, fitur ekspor Excel (`GET /reports/export/excel`) menghasilkan hyperlink untuk kolom foto. Ada permintaan untuk menyematkan (embed) gambar secara langsung ke dalam sel Excel.

## Opsi Solusi & Pertimbangan

1.  **Hyperlink (Implementasi Saat Ini):**
    *   **Pros:** Ukuran file Excel kecil, proses ekspor cepat, implementasi sederhana.
    *   **Cons:** Pengguna harus online dan mengklik link untuk melihat gambar.

2.  **Menyematkan Gambar Penuh:**
    *   **Pros:** Gambar langsung terlihat di dalam file Excel.
    *   **Cons:** Ukuran file Excel akan menjadi **sangat besar** (bisa puluhan/ratusan MB), performa Excel mungkin menurun saat dibuka, implementasi lebih kompleks (perlu membaca file gambar dari server dan menggunakan `worksheet.addImage()`).

3.  **Menyematkan Thumbnail + Hyperlink:**
    *   **Pros:** Memberikan preview visual kecil di sel, ukuran file lebih kecil daripada menyematkan gambar penuh, tetap ada link ke gambar asli.
    *   **Cons:** Implementasi paling kompleks (perlu membuat thumbnail saat upload atau saat ekspor, lalu menyematkan thumbnail dan membuat hyperlink).

## Status
- [x] Identifikasi masalah dan opsi solusi.
- [ ] Persetujuan manager mengenai pendekatan yang diinginkan (Hyperlink / Embed Penuh / Thumbnail + Hyperlink).
- [ ] Implementasi (jika berbeda dari hyperlink saat ini).
- [ ] Testing.
