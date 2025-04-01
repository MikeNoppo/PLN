import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto'; // Import new DTO
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { StatusLaporan } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    private readonly storageService: StorageService,
  ) {}

  // Renamed from 'create'
  async createYantek(
    createReportDto: CreateReportDto,
    files: {
      foto_rumah?: Express.Multer.File[],
      foto_meter_rusak?: Express.Multer.File[],
      foto_ba_gangguan?: Express.Multer.File[]
    }
  ) {
    // Validate required files
    if (!files.foto_rumah?.[0] || !files.foto_meter_rusak?.[0] || !files.foto_ba_gangguan?.[0]) {
      throw new BadRequestException('Semua foto wajib diunggah');
    }

    // Process and store files
    const [fotoRumahPath, fotoMeterPath, fotoBaPath] = await Promise.all([
      this.processAndSaveImage(files.foto_rumah[0], 'house'),
      this.processAndSaveImage(files.foto_meter_rusak[0], 'meter'),
      this.processAndSaveImage(files.foto_ba_gangguan[0], 'document'),
    ]);

    try {
      // Create report in database
      const report = await this.prisma.laporanYantek.create({
        data: {
          ...createReportDto,
          foto_rumah: fotoRumahPath,
          foto_meter_rusak: fotoMeterPath,
          foto_ba_gangguan: fotoBaPath,
          status_laporan: StatusLaporan.BARU,
        },
      });

      return report;
    } catch (error) {
      // Clean up stored files if database operation fails
      await Promise.all([
        this.storageService.deleteFile(fotoRumahPath),
        this.storageService.deleteFile(fotoMeterPath),
        this.storageService.deleteFile(fotoBaPath),
      ]);

      throw error;
    }
  }

  private async processAndSaveImage(
    file: Express.Multer.File,
    // Added new types for Penyambungan files
    type: 'house' | 'meter' | 'document' | 'penyambungan_meter' | 'penyambungan_rumah' | 'penyambungan_ba'
  ): Promise<string> {
    // Validate image
    const isValid = await this.imageService.validateImage(file.buffer);
    if (!isValid) {
      throw new BadRequestException('Format file tidak valid. Gunakan JPG, JPEG, atau PNG');
    }

    // Compress image
    const compressedBuffer = await this.imageService.compressImage(file.buffer);

    // Save compressed image
    // Adjust storage path based on type if necessary, assuming StorageService handles subdirs
    return this.storageService.saveFile(compressedBuffer, type, file.originalname);
  }

  async createPenyambungan(
    createPenyambunganDto: CreatePenyambunganDto,
    files: {
      foto_pemasangan_meter?: Express.Multer.File[];
      foto_rumah_pelanggan?: Express.Multer.File[];
      foto_ba_pemasangan?: Express.Multer.File[];
    }
  ) {
    // 1. Validate required files
    if (
      !files.foto_pemasangan_meter?.[0] ||
      !files.foto_rumah_pelanggan?.[0] ||
      !files.foto_ba_pemasangan?.[0]
    ) {
      throw new BadRequestException('Semua foto penyambungan wajib diunggah');
    }

    // 2. Validate related LaporanYantek
    const laporanYantek = await this.prisma.laporanYantek.findUnique({
      where: { id: createPenyambunganDto.laporan_yante_id },
    });

    if (!laporanYantek) {
      throw new NotFoundException(`Laporan Yantek dengan ID ${createPenyambunganDto.laporan_yante_id} tidak ditemukan.`);
    }

    if (laporanYantek.status_laporan === StatusLaporan.SELESAI) {
      throw new ConflictException(`Laporan Yantek dengan ID ${createPenyambunganDto.laporan_yante_id} sudah selesai.`);
    }
    
    // Check if penyambungan report already exists for this yantek report
    const existingPenyambungan = await this.prisma.laporanPenyambungan.findUnique({
        where: { laporan_yante_id: createPenyambunganDto.laporan_yante_id },
    });
    if (existingPenyambungan) {
        throw new ConflictException(`Laporan Penyambungan untuk Laporan Yantek ID ${createPenyambunganDto.laporan_yante_id} sudah ada.`);
    }


    // 3. Process and store files
    let fotoPemasanganPath: string | undefined;
    let fotoRumahPath: string | undefined;
    let fotoBaPath: string | undefined;

    try {
      [fotoPemasanganPath, fotoRumahPath, fotoBaPath] = await Promise.all([
        this.processAndSaveImage(files.foto_pemasangan_meter[0], 'penyambungan_meter'),
        this.processAndSaveImage(files.foto_rumah_pelanggan[0], 'penyambungan_rumah'),
        this.processAndSaveImage(files.foto_ba_pemasangan[0], 'penyambungan_ba'),
      ]);

      // 4. Perform database operations in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create LaporanPenyambungan
        const laporanPenyambungan = await prisma.laporanPenyambungan.create({
          data: {
            laporan_yante_id: createPenyambunganDto.laporan_yante_id,
            nama_petugas: createPenyambunganDto.nama_petugas,
            foto_pemasangan_meter: fotoPemasanganPath,
            foto_rumah_pelanggan: fotoRumahPath,
            foto_ba_pemasangan: fotoBaPath,
            status_laporan: StatusLaporan.SELESAI,
          },
        });

        // Update LaporanYantek status
        await prisma.laporanYantek.update({
          where: { id: createPenyambunganDto.laporan_yante_id },
          data: { status_laporan: StatusLaporan.SELESAI },
        });

        return laporanPenyambungan;
      });

      return result;

    } catch (error) {
      // Clean up stored files if any operation fails
      await Promise.all([
        fotoPemasanganPath ? this.storageService.deleteFile(fotoPemasanganPath) : Promise.resolve(),
        fotoRumahPath ? this.storageService.deleteFile(fotoRumahPath) : Promise.resolve(),
        fotoBaPath ? this.storageService.deleteFile(fotoBaPath) : Promise.resolve(),
      ]).catch(cleanupError => {
          // Log cleanup error if needed, but don't let it mask the original error
          console.error("Error during file cleanup:", cleanupError);
      });

      // Re-throw the original error
      // Consider adding specific Prisma error code handling (like P2002 if needed elsewhere)
      throw error;
    }
  }


  async findAll() {
    return this.prisma.laporanYantek.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.laporanYantek.findUnique({
      where: { id },
    });

    if (!report) {
      throw new BadRequestException('Laporan tidak ditemukan');
    }

    return report;
  }

  async remove(id: string) {
    const report = await this.findOne(id);

    // Delete associated files
    await Promise.all([
      this.storageService.deleteFile(report.foto_rumah),
      this.storageService.deleteFile(report.foto_meter_rusak),
      this.storageService.deleteFile(report.foto_ba_gangguan),
    ]);

    // Delete database record
    return this.prisma.laporanYantek.delete({
      where: { id },
    });
  }
}
