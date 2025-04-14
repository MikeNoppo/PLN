import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ExportFilterDto } from './dto/export-filter.dto';
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { StatusLaporan, TipeMeter } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { ConfigService } from '@nestjs/config';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FileValidator } from '../utils/file-validator.util';
import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageService: ImageService,
    private readonly configService: ConfigService,
  ) {}

  private async generateLaporanId(type: 'YT' | 'PS'): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${type}${year}${month}`;
    
    // Optimasi query dengan index
    const lastReport = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id 
      FROM "${type === 'YT' ? 'LaporanYantek' : 'LaporanPenyambungan'}"
      WHERE id >= ${prefix + '0000'}
        AND id <= ${prefix + '9999'}
      ORDER BY id DESC 
      LIMIT 1`;

    let sequence = 1;
    if (lastReport.length > 0) {
      const lastSequence = parseInt(lastReport[0].id.slice(-4));
      sequence = lastSequence + 1;
    }

    if (sequence > 9999) {
      throw new Error(`Sequence limit exceeded for ${prefix}`);
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  // Tambahkan simple caching untuk mengurangi query
  private lastGeneratedIds: Map<string, { id: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000; // 1 detik

  private async getNextId(type: 'YT' | 'PS'): Promise<string> {
    const now = Date.now();
    const currentPrefix = `${type}${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const cached = this.lastGeneratedIds.get(currentPrefix);

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      const lastSequence = parseInt(cached.id.slice(-4));
      const nextSequence = lastSequence + 1;
      const nextId = `${currentPrefix}${String(nextSequence).padStart(4, '0')}`;
      
      this.lastGeneratedIds.set(currentPrefix, { id: nextId, timestamp: now });
      return nextId;
    }

    const newId = await this.generateLaporanId(type);
    this.lastGeneratedIds.set(currentPrefix, { id: newId, timestamp: now });
    return newId;
  }

  validateAndProcessYantekFiles(files: {
    foto_rumah?: Express.Multer.File[];
    foto_meter_rusak?: Express.Multer.File[];
    foto_ba_gangguan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, ['foto_rumah', 'foto_meter_rusak', 'foto_ba_gangguan']);

    const allFiles = [
      { name: 'foto rumah', file: files.foto_rumah[0] },
      { name: 'foto meter rusak', file: files.foto_meter_rusak[0] },
      { name: 'foto BA gangguan', file: files.foto_ba_gangguan[0] },
    ];

    FileValidator.validateImageFiles(allFiles);
  }

  validateAndProcessPenyambunganFiles(files: {
    foto_pemasangan_meter?: Express.Multer.File[];
    foto_rumah_pelanggan?: Express.Multer.File[];
    foto_ba_pemasangan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, [
      'foto_pemasangan_meter',
      'foto_rumah_pelanggan',
      'foto_ba_pemasangan'
    ]);

    const allFiles = [
      { name: 'foto pemasangan meter', file: files.foto_pemasangan_meter[0] },
      { name: 'foto rumah pelanggan', file: files.foto_rumah_pelanggan[0] },
      { name: 'foto BA pemasangan', file: files.foto_ba_pemasangan[0] },
    ];

    FileValidator.validateImageFiles(allFiles);
  }

  prepareExcelResponse(buffer: Buffer, res: Response): StreamableFile {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Laporan_PLN_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    return new StreamableFile(buffer);
  }

  async createYantek(
    createReportDto: CreateReportDto,
    files: {
      foto_rumah?: Express.Multer.File[],
      foto_meter_rusak?: Express.Multer.File[],
      foto_ba_gangguan?: Express.Multer.File[]
    }
  ) {
    const id = await this.getNextId('YT');

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
          id,
          ...createReportDto,
          foto_rumah: fotoRumahPath,
          foto_meter_rusak: fotoMeterPath,
          foto_ba_gangguan: fotoBaPath,
          status_laporan: StatusLaporan.BARU,
        },
      });

      return {
        status: 201,
        message: 'Laporan Yantek berhasil dibuat',
        data: report,
      };

    } catch (error) {
      // Clean up stored files if database operation fails
      await Promise.all([
        this.storageService.deleteFile(fotoRumahPath),
        this.storageService.deleteFile(fotoMeterPath),
        this.storageService.deleteFile(fotoBaPath),
      ]);

      this.logger.error('Error creating report:', error);
      throw error;
    }
  }

  private async processAndSaveImage(
    file: Express.Multer.File,
    type: 'house' | 'meter' | 'document' | 'penyambungan_meter' | 'penyambungan_rumah' | 'penyambungan_ba'
  ): Promise<string> {
    const compressedImageBuffer = await this.imageService.compressImage(file.buffer);
    return this.storageService.saveFile(compressedImageBuffer, type, file.originalname);
  }

  async createPenyambungan(
    createPenyambunganDto: CreatePenyambunganDto,
    files: {
      foto_pemasangan_meter?: Express.Multer.File[];
      foto_rumah_pelanggan?: Express.Multer.File[];
      foto_ba_pemasangan?: Express.Multer.File[];
    }
  ) {
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
        const id = await this.getNextId('PS');

        // Create LaporanPenyambungan
        const laporanPenyambungan = await prisma.laporanPenyambungan.create({
          data: {
            id,
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

      return {
        status: 201,
        message: 'Laporan Penyambungan berhasil dibuat',
        data: result,
      };

    } catch (error) {
      // Clean up stored files if any operation fails
      await Promise.all([
        fotoPemasanganPath ? this.storageService.deleteFile(fotoPemasanganPath) : Promise.resolve(),
        fotoRumahPath ? this.storageService.deleteFile(fotoRumahPath) : Promise.resolve(),
        fotoBaPath ? this.storageService.deleteFile(fotoBaPath) : Promise.resolve(),
      ]).catch(cleanupError => {
          console.error("Error during file cleanup:", cleanupError);
      });

      // Re-throw the original error
      // Consider adding specific Prisma error code handling (like P2002 if needed elsewhere)
      throw error;
    }
  }


  async findAll(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.prisma.laporanYantek.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
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
        },
      }),
      this.prisma.laporanYantek.count(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.laporanYantek.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Laporan dengan ID ${id} tidak ditemukan`); 
    }

    return report;
  }

  async remove(id: string) {
    const report = await this.findOne(id);
    const fileDeletionResults = await Promise.all([
      this.storageService.deleteFile(report.foto_rumah),
      this.storageService.deleteFile(report.foto_meter_rusak),
      this.storageService.deleteFile(report.foto_ba_gangguan),
    ]);

    // Log any file deletion issues
    fileDeletionResults.forEach((result, index) => {
      if (result.error) {
        const fileType = ['foto_rumah', 'foto_meter_rusak', 'foto_ba_gangguan'][index];
        this.logger.warn(`Issue deleting ${fileType}: ${result.error}`);
      }
    });

    try {
      // Use transaction to ensure both deletions succeed or fail together
      const deletedReport = await this.prisma.$transaction(async (prisma) => {
        // First delete the related LaporanPenyambungan if it exists
        await prisma.laporanPenyambungan.deleteMany({
          where: { laporan_yante_id: id },
        });

        // Then delete the LaporanYantek
        return await prisma.laporanYantek.delete({
          where: { id },
        });
      });

      return {
        status: 200,
        message: 'Laporan berhasil dihapus',
        data: deletedReport,
      };
    } catch (error) {
      this.logger.error('Error deleting report:', error);
      throw new InternalServerErrorException('Gagal menghapus laporan');
    }
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
          report.nama_petugas || '-', 
          penyambungan?.nama_petugas || '-',
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

  // --- Update Status Functionality ---

  async updateStatus(id: string, dto: UpdateReportStatusDto): Promise<any> { // Consider returning the updated report type
    // 1. Find the report first to ensure it exists
    const report = await this.prisma.laporanYantek.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Laporan Yantek dengan ID ${id} tidak ditemukan.`);
    }

    // 2. Update the status
    try {
      const updatedReport = await this.prisma.laporanYantek.update({
        where: { id },
        data: {
          status_laporan: dto.status_laporan,
        },
      });
      return {
        status: 201,
        message: 'Status laporan berhasil diperbarui',
        data: updatedReport,
      };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui status laporan.');
    }
  }
}
