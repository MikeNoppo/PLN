import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ActivityType, StatusLaporan, UserRole } from '@prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FileValidator } from '../utils/file-validator.util';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageService: ImageService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // Modified to accept Prisma client (main or transaction)
  private async generateLaporanId(type: 'YT' | 'PS', prismaClient: Prisma.TransactionClient | PrismaService): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${type}${year}${month}`;
    const startRange = prefix + '0000';
    const endRange = prefix + '9999';

    const tableName = type === 'YT' ? "LaporanYantek" : "LaporanPenyambungan";

    const query = Prisma.sql`
      SELECT id 
      FROM "${Prisma.raw(tableName)}"
      WHERE id >= ${startRange}
        AND id <= ${endRange}
      ORDER BY id DESC 
      LIMIT 1`;

    // Execute the raw query using the provided client
    const lastReport = await prismaClient.$queryRaw<Array<{ id: string }>>(query);

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

  private async getNextId(type: 'YT' | 'PS', prismaClient: Prisma.TransactionClient | PrismaService): Promise<string> {
    const newId = await this.generateLaporanId(type, prismaClient);
    return newId;
  }


  validateAndProcessYantekFiles(files: {
    foto_rumah?: Express.Multer.File[];
    foto_meter_rusak?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_gangguan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, ['foto_rumah', 'foto_meter_rusak', 'foto_petugas', 'foto_ba_gangguan']);

    const allFiles = [
      { name: 'foto rumah', file: files.foto_rumah[0] },
      { name: 'foto meter rusak', file: files.foto_meter_rusak[0] },
      { name: 'foto petugas', file: files.foto_petugas[0] },
      { name: 'foto BA gangguan', file: files.foto_ba_gangguan[0] },
    ];

    FileValidator.validateImageFiles(allFiles);
  }

  validateAndProcessPenyambunganFiles(files: {
    foto_pemasangan_meter?: Express.Multer.File[];
    foto_rumah_pelanggan?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_pemasangan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, [
      'foto_pemasangan_meter',
      'foto_rumah_pelanggan',
      'foto_petugas',
      'foto_ba_pemasangan'
    ]);

    const allFiles = [
      { name: 'foto pemasangan meter', file: files.foto_pemasangan_meter[0] },
      { name: 'foto rumah pelanggan', file: files.foto_rumah_pelanggan[0] },
      { name: 'foto petugas', file: files.foto_petugas[0] },
      { name: 'foto BA pemasangan', file: files.foto_ba_pemasangan[0] },
    ];

    FileValidator.validateImageFiles(allFiles);
  }

  async createYantek(
    createReportDto: CreateReportDto,
    files: {
      foto_rumah?: Express.Multer.File[],
      foto_meter_rusak?: Express.Multer.File[],
      foto_petugas?: Express.Multer.File[],
      foto_ba_gangguan?: Express.Multer.File[]
    },
    userId?: string,
  ) {
    // Process and store files first (outside transaction)
    const [fotoRumahPath, fotoMeterPath, fotoPetugasPath, fotoBaPath] = await Promise.all([
      this.processAndSaveImage(files.foto_rumah[0], 'house'),
      this.processAndSaveImage(files.foto_meter_rusak[0], 'meter'),
      this.processAndSaveImage(files.foto_petugas[0], 'petugas'),
      this.processAndSaveImage(files.foto_ba_gangguan[0], 'document'),
    ]);

    let report; // Declare report variable outside transaction scope
    try {
      // Use transaction for ID generation and report creation
      report = await this.prisma.$transaction(async (tx) => {
        const id = await this.getNextId('YT', tx); // Pass transaction client

        const createdReport = await tx.laporanYantek.create({ // Use tx client
          data: {
            id,
            ...createReportDto,
            foto_rumah: fotoRumahPath,
            foto_meter_rusak: fotoMeterPath,
            foto_petugas: fotoPetugasPath,
            foto_ba_gangguan: fotoBaPath,
            status_laporan: StatusLaporan.BARU,
          },
        });
        return createdReport; // Return the created report from transaction
      });

      // *** Create Activity Log (outside transaction, using the created report ID) ***
      if (userId && report) { // Check if report was successfully created
        await this.activityLogsService.createLog({
          activityType: ActivityType.REPORT_CREATED,
          createdYantekReportId: report.id, // Use the ID from the created report
          deletedReportId:report.id,
          createdByUserId: userId,
          message: `Laporan Yantek baru [${report.id}] dibuat.`,
        }).catch(logError => {
          // Log error but don't fail the whole operation if logging fails
          this.logger.error(`Failed to create activity log for Yantek creation ${report?.id}:`, logError);
        });
      }

      return {
        status: 201,
        message: 'Laporan Yantek berhasil dibuat',
        data: report, // Return the report created within the transaction
      };

    } catch (error) {
      // Clean up stored files if database transaction fails or subsequent logging fails
      this.logger.error('Error during Yantek creation transaction or logging:', error);
      await Promise.all([
        this.storageService.deleteFile(fotoRumahPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`)),
        this.storageService.deleteFile(fotoMeterPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoMeterPath}: ${e}`)),
        this.storageService.deleteFile(fotoPetugasPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoPetugasPath}: ${e}`)),
        this.storageService.deleteFile(fotoBaPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`)),
      ]);
      // Re-throw the original error after cleanup attempt
      throw error;
    }
  }


  private async processAndSaveImage(
    file: Express.Multer.File,
    type: 'house' | 'meter' | 'document' | 'petugas' | 'penyambungan_meter' | 'penyambungan_rumah' | 'penyambungan_ba'
  ): Promise<string> {
    const MAX_SIZE_WITHOUT_COMPRESSION = 50 * 1024 * 1024; // 50MB in bytes

    let imageBuffer: Buffer;
    
    if (file.size > MAX_SIZE_WITHOUT_COMPRESSION) {
      // Kompresi hanya untuk file yang lebih dari 50MB
      imageBuffer = await this.imageService.compressImage(file.buffer);
    } else {
      // Gunakan file asli tanpa kompresi
      imageBuffer = file.buffer;
    }
    return this.storageService.saveFile(imageBuffer, type, file.originalname);
  }

  async createPenyambungan(
    createPenyambunganDto: CreatePenyambunganDto,
    files: {
      foto_pemasangan_meter?: Express.Multer.File[];
      foto_rumah_pelanggan?: Express.Multer.File[];
      foto_petugas?: Express.Multer.File[];
      foto_ba_pemasangan?: Express.Multer.File[];
    },
    userId?: string,
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
    let fotoPetugasPath: string | undefined;
    let fotoBaPath: string | undefined;

    try {
      [fotoPemasanganPath, fotoRumahPath, fotoPetugasPath, fotoBaPath] = await Promise.all([
        this.processAndSaveImage(files.foto_pemasangan_meter[0], 'penyambungan_meter'),
        this.processAndSaveImage(files.foto_rumah_pelanggan[0], 'penyambungan_rumah'),
        this.processAndSaveImage(files.foto_petugas[0], 'petugas'),
        this.processAndSaveImage(files.foto_ba_pemasangan[0], 'penyambungan_ba'),
      ]);

      // 4. Perform database operations in a transaction
      let result; // Declare result outside transaction scope
      try {
        result = await this.prisma.$transaction(async (tx) => { // Use tx for transaction client
          // Generate ID within the transaction
          const id = await this.getNextId('PS', tx); // Pass transaction client

          // Create LaporanPenyambungan using transaction client
          const laporanPenyambungan = await tx.laporanPenyambungan.create({
            data: {
              id,
              laporan_yante_id: createPenyambunganDto.laporan_yante_id,
              nama_petugas: createPenyambunganDto.nama_petugas,
              foto_pemasangan_meter: fotoPemasanganPath,
              foto_rumah_pelanggan: fotoRumahPath,
              foto_petugas: fotoPetugasPath,
              foto_ba_pemasangan: fotoBaPath,
              status_laporan: StatusLaporan.SELESAI,
            },
          });

          // Update LaporanYantek status using transaction client
          await tx.laporanYantek.update({
            where: { id: createPenyambunganDto.laporan_yante_id },
            data: { status_laporan: StatusLaporan.SELESAI },
          });

          // Return the created penyambungan report from transaction
          return laporanPenyambungan;
        });

        // *** Create Activity Log ***
        if (userId && result) { // Check if transaction was successful and result exists
          await this.activityLogsService.createLog({
            activityType: ActivityType.REPORT_COMPLETED,
            createdYantekReportId: createPenyambunganDto.laporan_yante_id,
            createdPenyambunganReportId: result.id, // Use ID from transaction result
            createdByUserId: userId,
            message: `Laporan [${createPenyambunganDto.laporan_yante_id}] diselesaikan via penyambungan [${result.id}].`,
          }).catch(logError => {
            // Log error but don't fail the whole operation if logging fails
            this.logger.error(`Failed to create activity log for Penyambungan completion ${result?.id}:`, logError);
          });
        }

        return {
          status: 201,
          message: 'Laporan Penyambungan berhasil dibuat',
          data: result,
        };

      } catch (error) {
        // Clean up stored files if transaction or logging fails
        this.logger.error('Error during Penyambungan creation transaction or logging:', error);
        await Promise.all([
          fotoPemasanganPath ? this.storageService.deleteFile(fotoPemasanganPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoPemasanganPath}: ${e}`)) : Promise.resolve(),
          fotoRumahPath ? this.storageService.deleteFile(fotoRumahPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`)) : Promise.resolve(),
          fotoPetugasPath ? this.storageService.deleteFile(fotoPetugasPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoPetugasPath}: ${e}`)) : Promise.resolve(),
          fotoBaPath ? this.storageService.deleteFile(fotoBaPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`)) : Promise.resolve(),
        ]);
        // Re-throw the original error after cleanup attempt
        throw error;
      }
    } catch (error) { // This outer catch handles errors from file processing before the transaction
      this.logger.error('Error processing Penyambungan files before transaction:', error);
      // Attempt cleanup even if file processing failed partially
      await Promise.all([
        fotoPemasanganPath ? this.storageService.deleteFile(fotoPemasanganPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoPemasanganPath}: ${e}`)) : Promise.resolve(),
        fotoRumahPath ? this.storageService.deleteFile(fotoRumahPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`)) : Promise.resolve(),
        fotoPetugasPath ? this.storageService.deleteFile(fotoPetugasPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoPetugasPath}: ${e}`)) : Promise.resolve(),
        fotoBaPath ? this.storageService.deleteFile(fotoBaPath).catch(e => this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`)) : Promise.resolve(),
      ]);
      throw error; // Re-throw the file processing error
    }
  }


async FindActiveReport(paginationQuery: PaginationQueryDto, userId?: string, userRole?: UserRole) {
  const { page = 1, limit = 10 } = paginationQuery;
  const skip = (page - 1) * limit;

  // First, fetch all active reports - properly destructure both results
  const [allData, totalCount] = await Promise.all([
    this.prisma.laporanYantek.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        status_laporan: {
          in: [StatusLaporan.BARU],
        },
      },
      // Tidak ada include activityLogs karena tidak ada relasi
    }),
    this.prisma.laporanYantek.count({
      where: {
        status_laporan: {
          in: [StatusLaporan.BARU],
        },
      },
    }),
  ]);

    // Jika filtering by userId diperlukan, lakukan query activity log terpisah
    let filteredData = [...allData];
    if (userRole === UserRole.PETUGAS_YANTEK && userId) {
      // Query activity log untuk dapatkan id laporan yang dibuat user ini
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_CREATED,
          createdByUserId: userId,
        },
        select: { createdYantekReportId: true },
      });
      const allowedIds = userLogs.map(log => log.createdYantekReportId).filter(Boolean);
      filteredData = allData.filter(report => allowedIds.includes(report.id));
    }
    // Apply pagination after filtering
    const paginatedData = filteredData.slice(skip, skip + limit);
    const filteredTotal = filteredData.length;
    const totalPages = Math.ceil(filteredTotal / limit);

    // Tidak perlu mapping activityLogs
    const data = paginatedData;

    return {
      data,
      meta: {
        totalItems: filteredTotal,
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

  async remove(id: string, userId?: string) {
    this.logger.log(`Attempting to remove report ${id}, initiated by userId: ${userId}`); // Log entry point
    const report = await this.findOne(id);

    // *** Create Activity Log BEFORE deleting ***
    if (userId) { 
        this.logger.log(`User ID ${userId} provided, proceeding to create delete log for report ${id}.`);
        await this.activityLogsService.createLog({
            activityType: ActivityType.REPORT_DELETED,
            createdYantekReportId: id,
            deletedReportId: id, // <-- simpan ID laporan yang dihapus
            createdByUserId: userId,
            message: `Laporan Yantek [${id}] dihapus.`,
        }).catch(logError => { 
            this.logger.error(`Failed log deletion for report ${id}:`, logError); 
        });
    } else {
        this.logger.warn(`Skipping delete activity log for report ${id} because userId was undefined or null.`);
    }

    // Delete associated files
    const fileDeletionResults = await Promise.all([
      this.storageService.deleteFile(report.foto_rumah),
      this.storageService.deleteFile(report.foto_meter_rusak),
      this.storageService.deleteFile(report.foto_petugas),
      this.storageService.deleteFile(report.foto_ba_gangguan),
    ]);

    // Log any file deletion issues
    fileDeletionResults.forEach((result, index) => {
      if (result.error) {
        const fileType = ['foto_rumah', 'foto_meter_rusak', 'foto_petugas', 'foto_ba_gangguan'][index];
        this.logger.warn(`Issue deleting ${fileType} for report ${id}: ${result.error}`);
      }
    });

    try {
      // Use transaction to ensure related data deletion happens together
      // Note: ActivityLog deletion related to this report is handled by `onDelete: Cascade` in schema
      //       LaporanPenyambungan deletion is handled below
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

      this.logger.log(`Successfully deleted report ${id}.`);
      return {
        status: 200,
        message: 'Laporan berhasil dihapus',
        data: { id: deletedReport.id }, 
      };
    } catch (error) {
      this.logger.error(`Error during database deletion for report ${id}:`, error);
      throw new InternalServerErrorException('Gagal menghapus laporan.');
    }
  }

  async updateStatus(id: string, dto: UpdateReportStatusDto, userId?: string): Promise<any> {
    const report = await this.prisma.laporanYantek.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Laporan Yantek dengan ID ${id} tidak ditemukan.`);
    }

    const previousStatus = report.status_laporan;
    const newStatus = dto.status_laporan;

    if (previousStatus === newStatus) {
      return {
        status: 200, // OK, but no change
        message: 'Status laporan tidak berubah.',
        data: report, // Return the existing report data
      };
    }

    const shouldLogCompletion = newStatus === StatusLaporan.SELESAI && previousStatus !== StatusLaporan.SELESAI;
    const shouldLogProcessing = newStatus === StatusLaporan.DIPROSES && previousStatus !== StatusLaporan.DIPROSES;
    const shouldLogGenericUpdate = !shouldLogCompletion && !shouldLogProcessing;

    try {
      const updatedReport = await this.prisma.laporanYantek.update({
        where: { id },
        data: { status_laporan: newStatus },
      });

      // Log based on status transition
      if (userId) { // Only log if user is known
        if (shouldLogCompletion) {
          await this.activityLogsService.createLog({
            activityType: ActivityType.REPORT_COMPLETED,
            createdYantekReportId: id,
            createdByUserId: userId,
            message: `Laporan [${id}] status diubah menjadi SELESAI (dari ${previousStatus}).`,
          }).catch(logError => { this.logger.error(`Failed log completion for ${id}:`, logError); });
        } else if (shouldLogProcessing) {
          await this.activityLogsService.createLog({
            activityType: ActivityType.REPORT_PROCESSED,
            createdYantekReportId: id,
            createdByUserId: userId,
            message: `Laporan [${id}] status diubah menjadi DIPROSES (dari ${previousStatus}).`,
          }).catch(logError => { this.logger.error(`Failed log processing for ${id}:`, logError); });
        } else if (shouldLogGenericUpdate) { 
          await this.activityLogsService.createLog({
            activityType: ActivityType.REPORT_UPDATED, 
            createdYantekReportId: id,
            createdByUserId: userId,
            message: `Laporan [${id}] status diubah dari ${previousStatus} menjadi ${newStatus}.`,
          }).catch(logError => { this.logger.error(`Failed log status update for ${id}:`, logError); });
        }
      }

      return {
        status: 200, // Use 200 OK for successful updates
        message: 'Status laporan berhasil diperbarui',
        data: updatedReport,
      };
    } catch (error) {
      this.logger.error(`Error updating status for report ${id}:`, error); 
      throw new InternalServerErrorException('Gagal memperbarui status laporan.');
    }
  }

  async findHistory(paginationQuery: PaginationQueryDto, userId?: string, userRole?: UserRole) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    // First fetch all completed reports with their relationship data
    const [allData, totalItems] = await Promise.all([
      this.prisma.laporanYantek.findMany({
        orderBy: { createdAt: 'desc' },
        where: {
          status_laporan: StatusLaporan.SELESAI,
          NOT: { laporan_penyambungan: null },
        },        include: {
          laporan_penyambungan: {
            select: {
              createdAt: true,
              nama_petugas: true,
              foto_pemasangan_meter: true,
              foto_rumah_pelanggan: true,
              foto_ba_pemasangan: true,
              status_laporan: true,
            },
          }
        },
      }),
      this.prisma.laporanYantek.count({
        where: {
          status_laporan: StatusLaporan.SELESAI,
          NOT: { laporan_penyambungan: null },
        },
      }),
    ]);

    // Then filter in the application layer based on role and userId
    let filteredData = [...allData];
    
    // If user is PETUGAS_YANTEK, only show reports they created
    if (userRole === UserRole.PETUGAS_YANTEK && userId) {
      // Query activity log untuk dapatkan id laporan yang dibuat user ini
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_CREATED,
          createdByUserId: userId,
        },
        select: { createdYantekReportId: true },
      });
      const allowedIds = userLogs.map(log => log.createdYantekReportId).filter(Boolean);
      filteredData = allData.filter(report => allowedIds.includes(report.id));
    }
    // ADMIN sees everything (no filtering)

    // Apply pagination after filtering
    const paginatedData = filteredData.slice(skip, skip + limit);
    const filteredTotal = filteredData.length;
    const totalPages = Math.ceil(filteredTotal / limit);

    // Map the data to remove the activityLogs which was only used for filtering
    const data = paginatedData;

    return {
      data,
      meta: {
        totalItems: filteredTotal,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findYantekHistoryForPetugas(paginationQuery: PaginationQueryDto, userFullname: string) { // Changed userId to userFullname
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    // No need to query ActivityLog here as LaporanYantek directly contains nama_petugas

    // Fetch SELESAI LaporanYantek that were created by this user (based on nama_petugas)
    const [data, totalItems] = await Promise.all([
      this.prisma.laporanYantek.findMany({
        where: {
          nama_petugas: userFullname, // Filter by nama_petugas
          status_laporan: StatusLaporan.SELESAI,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: { // Include details similar to findHistory for consistency
          laporan_penyambungan: {
            select: {
              createdAt: true,
              nama_petugas: true,
              foto_pemasangan_meter: true,
              foto_rumah_pelanggan: true,
              foto_ba_pemasangan: true,
              status_laporan: true,
            },
          },
        },
        skip: skip,
        take: limit,
      }),
      this.prisma.laporanYantek.count({
        where: {
          nama_petugas: userFullname, // Filter by nama_petugas for count
          status_laporan: StatusLaporan.SELESAI,
        },
      }),
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

  async findPenyambunganReports(paginationQuery: PaginationQueryDto, userId?: string, userRole?: UserRole) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    // First fetch all penyambungan reports
    const [allData, totalItems] = await Promise.all([
      this.prisma.laporanPenyambungan.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          laporan_yante: {
            select: {
              ID_Pelanggan: true,
              nomor_meter: true,
              tipe_meter: true,
              no_telepon_pelanggan: true,
              keterangan: true,
            },
          },
        },
      }),
      this.prisma.laporanPenyambungan.count(),
    ]);
    // Then filter in the application layer based on role and userId
    let filteredData = [...allData];
    
    // If user is PETUGAS_PENYAMBUNGAN, only show reports they created
    if (userRole === UserRole.PETUGAS_PENYAMBUNGAN && userId) {
      // Query activity log untuk dapatkan id laporan penyambungan yang dibuat user ini
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_COMPLETED,
          createdByUserId: userId,
        },
        select: { createdPenyambunganReportId: true },
      });
      const allowedIds = userLogs.map(log => log.createdPenyambunganReportId).filter(Boolean);
      filteredData = allData.filter(report => allowedIds.includes(report.id));
    }
    // ADMIN sees everything (no filtering)

    // Apply pagination after filtering
    const paginatedData = filteredData.slice(skip, skip + limit);
    const filteredTotal = filteredData.length;
    const totalPages = Math.ceil(filteredTotal / limit);

    // Map the data to remove the activityLogs which was only used for filtering
    const data = paginatedData;

    return {
      data,
      meta: {
        totalItems: filteredTotal,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findPenyambunganHistoryForPetugas(paginationQuery: PaginationQueryDto, userId: string) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    // 1. Get IDs of LaporanPenyambungan completed by this PETUGAS_PENYAMBUNGAN
    const userCompletedLogs = await this.prisma.activityLog.findMany({
      where: {
        createdByUserId: userId,
        activityType: ActivityType.REPORT_COMPLETED,
        NOT: { createdPenyambunganReportId: null }, // Ensure it's a penyambungan completion log
      },
      select: {
        createdPenyambunganReportId: true,
      },
    });

    const completedPenyambunganIds = userCompletedLogs
      .map(log => log.createdPenyambunganReportId)
      .filter(id => id !== null) as string[];

    if (completedPenyambunganIds.length === 0) {
      return {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: limit,
          totalPages: 0,
          currentPage: page,
        },
      };
    }

    // 2. Fetch LaporanPenyambungan that were completed by this user
    const [data, totalItems] = await Promise.all([
      this.prisma.laporanPenyambungan.findMany({
        where: {
          id: {
            in: completedPenyambunganIds,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: { // Include details of the related LaporanYantek
          laporan_yante: {
            select: {
              ID_Pelanggan: true,
              nomor_meter: true,
              tipe_meter: true,
              no_telepon_pelanggan: true,
              keterangan: true,
              // Anda bisa menambahkan field lain dari LaporanYantek jika diperlukan
            },
          },
        },
        skip: skip,
        take: limit,
      }),
      this.prisma.laporanPenyambungan.count({
        where: {
          id: {
            in: completedPenyambunganIds,
          },
        },
      }),
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
}
