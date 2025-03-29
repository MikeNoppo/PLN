import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
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

  async create(
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
    type: 'house' | 'meter' | 'document'
  ): Promise<string> {
    // Validate image
    const isValid = await this.imageService.validateImage(file.buffer);
    if (!isValid) {
      throw new BadRequestException('Format file tidak valid. Gunakan JPG, JPEG, atau PNG');
    }

    // Compress image
    const compressedBuffer = await this.imageService.compressImage(file.buffer);

    // Save compressed image
    return this.storageService.saveFile(compressedBuffer, type, file.originalname);
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
