import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ExportFilterDto } from './dto/export-filter.dto'; // Import export DTO
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { StatusLaporan, TipeMeter } from '@prisma/client'; // Import TipeMeter
import * as ExcelJS from 'exceljs'; // Import exceljs
import { ConfigService } from '@nestjs/config'; // Import ConfigService for base URL

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService, // Inject ConfigService
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

  // --- Export Functionality ---

  async exportReportsToExcel(filterDto: ExportFilterDto): Promise<Buffer> {
    const { year, month, tipe_meter, petugas_yantek_id } = filterDto;

    const whereClause: any = {}; // Use 'any' for dynamic where clause building

    if (tipe_meter) {
      whereClause.tipe_meter = tipe_meter;
    }
    if (petugas_yantek_id) {
      // Assuming nama_petugas is stored directly in LaporanYantek based on schema
      // If it was an ID relation, you'd filter by that relation's ID
      whereClause.nama_petugas = { contains: petugas_yantek_id, mode: 'insensitive' };
    }

    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1); // Month is 0-indexed
      const endDate = new Date(year, month ? month : 12, 0); // Get last day of month/year
      
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else if (month) {
        // Handle month filter without year? Might need clarification or ignore.
        // For now, assuming month filter only works with year filter.
        console.warn("Month filter provided without year filter, ignoring month filter.");
    }


    // 2. Fetch Data
    const reports = await this.prisma.laporanYantek.findMany({
      where: whereClause,
      include: {
        laporan_penyambungan: {
          select: {
            createdAt: true,
            nama_petugas: true,
            foto_pemasangan_meter: true,
            foto_rumah_pelanggan: true,
            foto_ba_pemasangan: true,
          },
        },
        // No need to include petugasYantek if name is directly on LaporanYantek
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (reports.length === 0) {
      throw new NotFoundException('Tidak ada data laporan yang ditemukan sesuai filter.');
    }

    // 3. Generate Excel
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan PLN');

      // --- Template (Optional - Basic Title) ---
      worksheet.mergeCells('A1:M1'); // Merge across all expected columns
      worksheet.getCell('A1').value = 'Laporan Yantek dan Penyambungan';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      worksheet.addRow([]); // Add empty row for spacing

      // --- Header Row ---
      const headerRow = worksheet.addRow([
        'No', 'IDPEL', 'Nomor Meter', 'Tgl Lap. Yantek', 'Tgl Lap. Penyambungan',
        'Petugas Yantek', 'Petugas Penyambungan', 'Foto Rumah', 'Foto Meter Rusak',
        'Foto BA Gangguan', 'Foto Pasang Meter', 'Foto Rumah Pelanggan', 'Foto BA Pasang',
        'Status Laporan'
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }, // Light grey
        };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      // --- Data Rows ---
      const baseUrl = this.configService.get('APP_URL'); // Get base URL or default

      reports.forEach((report, index) => {
        const penyambungan = report.laporan_penyambungan;

        // Helper to create hyperlink
        const createHyperlink = (relativePath: string | null | undefined) => {
          if (!relativePath) return '-';
          // Basic check if it's already a full URL (less likely from our storage)
          if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
             return { text: 'Lihat Foto', hyperlink: relativePath };
          }
          // Construct full URL - ensure no double slashes if baseUrl ends with / and relativePath starts with /
          const fullUrl = `${baseUrl.replace(/\/$/, '')}/uploads/reports/${relativePath.replace(/^\//, '')}`;
          return { text: 'Lihat Foto', hyperlink: fullUrl };
        };

        const formatDate = (date: Date | null | undefined) => {
            if (!date) return '-';
            // Simple YYYY-MM-DD format
            return date.toISOString().split('T')[0];
        }

        const row = worksheet.addRow([
          index + 1,
          report.ID_Pelanggan,
          report.nomor_meter,
          formatDate(report.createdAt),
          formatDate(penyambungan?.createdAt),
          report.nama_petugas || '-', // Petugas Yantek
          penyambungan?.nama_petugas || '-', // Petugas Penyambungan
          createHyperlink(report.foto_rumah),
          createHyperlink(report.foto_meter_rusak),
          createHyperlink(report.foto_ba_gangguan),
          createHyperlink(penyambungan?.foto_pemasangan_meter),
          createHyperlink(penyambungan?.foto_rumah_pelanggan),
          createHyperlink(penyambungan?.foto_ba_pemasangan),
          report.status_laporan,
        ]);

        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'top', horizontal: 'left' }; // Align data left/top
        });
        // Specific alignment for No column
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
      });

      // --- Column Widths ---
      worksheet.columns = [
        { key: 'no', width: 5 },
        { key: 'idpel', width: 15 },
        { key: 'nomorMeter', width: 15 },
        { key: 'tglYantek', width: 15 },
        { key: 'tglPenyambungan', width: 15 },
        { key: 'petugasYantek', width: 20 },
        { key: 'petugasPenyambungan', width: 20 },
        { key: 'fotoRumah', width: 15 },
        { key: 'fotoMeterRusak', width: 15 },
        { key: 'fotoBaGangguan', width: 15 },
        { key: 'fotoPasangMeter', width: 15 },
        { key: 'fotoRumahPelanggan', width: 15 },
        { key: 'fotoBaPasang', width: 15 },
        { key: 'status', width: 15 },
      ];

      // 4. Generate Buffer
      return await workbook.xlsx.writeBuffer() as Buffer;

    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw new InternalServerErrorException('Gagal membuat file Excel.');
    }
  }
}
