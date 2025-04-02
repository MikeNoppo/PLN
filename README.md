# Backend API Aplikasi Mobile PLN

<p align="center">
  <img src="https://helloborneo.com/wp-content/uploads/2017/09/Logo-PLN-300x214.gif" width="300" alt="Logo PLN" />
</p>

<p align="center">
  API backend untuk aplikasi mobile PLN yang menangani pelaporan gangguan meter, autentikasi petugas, manajemen laporan, dan ekspor data. Dibangun menggunakan NestJS dan TypeScript.
</p>

---

## Teknologi yang Digunakan

*   **Framework:** [NestJS](https://nestjs.com/) (TypeScript)
*   **Database:** [PostgreSQL](https://www.postgresql.org/)
*   **ORM:** [Prisma](https://www.prisma.io/)
*   **Autentikasi:** JWT (Access & Refresh Token) - `@nestjs/jwt`, `passport-jwt`
*   **Validasi:** `class-validator`, `class-transformer`
*   **Upload File:** `multer`
*   **Pemrosesan Gambar:** `sharp`
*   **Pembuatan Excel:** `exceljs`
*   **Keamanan Tambahan:** `helmet`, `@nestjs/throttler`
*   **Lainnya:** `bcrypt`, `date-fns`

## Prasyarat

*   [Node.js](https://nodejs.org/) (Direkomendasikan versi LTS v18 atau v20)
*   [npm](https://www.npmjs.com/) (Terinstal bersama Node.js)
*   [PostgreSQL](https://www.postgresql.org/download/) Server (atau [Docker](https://www.docker.com/))

## Instalasi & Menjalankan Proyek

1.  **Clone Repository:**
    ```bash
    # Ganti dengan URL repository Anda
    git clone [URL_REPOSITORY_ANDA]
    ```

2.  **Masuk ke Direktori Proyek:**
    ```bash
    cd magang_be
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    ```

4.  **Setup Database:**
    *   Pastikan server PostgreSQL Anda berjalan.
    *   Buat database baru untuk proyek ini (misal: `pln_app_dev`).
    *   Salin file `.env.example` (jika ada) menjadi `.env`. Jika tidak ada, buat file `.env` secara manual.
    *   Edit file `.env` dan sesuaikan variabel `DATABASE_URL` dengan detail koneksi database Anda:
        ```env
        DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME"
        # Contoh: DATABASE_URL="postgresql://postgres:rey12321@localhost:5432/pln_app_dev"
        ```
    *   Isi variabel environment lainnya di `.env`. **Penting:** Gunakan nilai yang kuat dan rahasia untuk `JWT_SECRET` dan `REFRESH_TOKEN_SECRET`.
        ```env
        APP_URL=http://localhost:3000 # Sesuaikan jika port berbeda atau saat deployment
        JWT_SECRET= # Generate secret yang kuat (misal: openssl rand -hex 32)
        REFRESH_TOKEN_SECRET= # Generate secret yang kuat lainnya
        AT_EXPIRES_IN=1h
        RT_EXPIRES_IN=7d
        PORT=3000 # Sesuaikan jika perlu
        MAX_FILE_SIZE=50 # Dalam MB
        ```

5.  **Jalankan Migrasi Database:**
    Perintah ini akan membuat tabel-tabel di database Anda sesuai dengan schema Prisma.
    ```bash
    npx prisma migrate dev
    ```

6.  **(Opsional) Seed Database:**
    Jika Anda perlu mengisi data awal (misal: user admin, petugas), jalankan script seed:
    ```bash
    # Sesuaikan nama script jika berbeda
    npm run prisma:seed
    npm run prisma:seed-petugas
    ```

7.  **Jalankan Aplikasi (Mode Development):**
    Aplikasi akan berjalan dan otomatis me-restart jika ada perubahan kode.
    ```bash
    npm run start:dev
    ```
    Aplikasi akan tersedia di URL yang Anda set di `APP_URL` atau default `http://localhost:3000`.

## Menjalankan Aplikasi (Mode Produksi)

```bash
# 1. Build aplikasi
npm run build

# 2. Jalankan dari hasil build
npm run start:prod
```

## Dokumentasi API

Dokumentasi API interaktif (Swagger UI) tersedia setelah aplikasi berjalan. Akses melalui browser di:

`http://localhost:3000/api/docs` (Ganti port jika Anda mengubahnya di `.env`)

## Referensi Tambahan

*   **Dokumentasi NestJS:** [https://docs.nestjs.com/](https://docs.nestjs.com/) - Sangat direkomendasikan jika Anda baru mengenal NestJS.

---
