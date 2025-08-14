import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ActivityType, StatusLaporan, UserRole } from '@prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { ReportIdService } from './services/report-id.service';
import { ReportFileService } from './services/report-file.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FileValidator } from '../utils/file-validator.util';
import { ReportValidationService } from './services/report-validation.service';
import { paginate, buildMeta } from '../common/pagination.util';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageService: ImageService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly reportIdService: ReportIdService,
    private readonly reportFileService: ReportFileService,
    private readonly reportValidationService: ReportValidationService,
  ) {}

  validateAndProcessYantekFiles(files: {
    foto_rumah?: Express.Multer.File[];
    foto_meter_rusak?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_gangguan?: Express.Multer.File[];
  }) {
    this.reportValidationService.validateYantekFiles(files);
  }

  validateAndProcessPenyambunganFiles(files: {
    foto_pemasangan_meter?: Express.Multer.File[];
    foto_rumah_pelanggan?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_pemasangan?: Express.Multer.File[];
  }) {
    this.reportValidationService.validatePenyambunganFiles(files);
  }

  async createYantek(
    createReportDto: CreateReportDto,
    files: {
      foto_rumah?: Express.Multer.File[];
      foto_meter_rusak?: Express.Multer.File[];
      foto_petugas?: Express.Multer.File[];
      foto_ba_gangguan?: Express.Multer.File[];
    },
    userId?: string,
  ) {
    // Process and store files first (outside transaction)
    const [fotoRumahPath, fotoMeterPath, fotoPetugasPath, fotoBaPath] =
      await Promise.all([
        this.reportFileService.processAndSaveImage(
          files.foto_rumah[0],
          'house',
        ),
        this.reportFileService.processAndSaveImage(
          files.foto_meter_rusak[0],
          'meter',
        ),
        this.reportFileService.processAndSaveImage(
          files.foto_petugas[0],
          'petugas',
        ),
        this.reportFileService.processAndSaveImage(
          files.foto_ba_gangguan[0],
          'document',
        ),
      ]);

    let report;
    try {
      // Use transaction for ID generation and report creation
      report = await this.prisma.$transaction(async (tx) => {
        const id = await this.reportIdService.getNextId('YT', tx); // Pass transaction client

        const createdReport = await tx.laporanYantek.create({
          // Use tx client
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
      if (userId && report) {
        // Check if report was successfully created
        await this.activityLogsService
          .createLog({
            activityType: ActivityType.REPORT_CREATED,
            createdYantekReportId: report.id, // Use the ID from the created report
            createdByUserId: userId,
            message: `Laporan Yantek baru [${report.id}] dibuat.`,
          })
          .catch((logError) => {
            // Log error but don't fail the whole operation if logging fails
            this.logger.error(
              `Failed to create activity log for Yantek creation ${report?.id}:`,
              logError,
            );
          });
      }

      return {
        status: 201,
        message: 'Laporan Yantek berhasil dibuat',
        data: report, // Return the report created within the transaction
      };
    } catch (error) {
      // Clean up stored files if database transaction fails or subsequent logging fails
      this.logger.error(
        'Error during Yantek creation transaction or logging:',
        error,
      );
      await Promise.all([
        this.storageService
          .deleteFile(fotoRumahPath)
          .catch((e) =>
            this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`),
          ),
        this.storageService
          .deleteFile(fotoMeterPath)
          .catch((e) =>
            this.logger.warn(`Cleanup failed for ${fotoMeterPath}: ${e}`),
          ),
        this.storageService
          .deleteFile(fotoPetugasPath)
          .catch((e) =>
            this.logger.warn(`Cleanup failed for ${fotoPetugasPath}: ${e}`),
          ),
        this.storageService
          .deleteFile(fotoBaPath)
          .catch((e) =>
            this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`),
          ),
      ]);
      // Re-throw the original error after cleanup attempt
      throw error;
    }
  }

  // moved: file processing handled by ReportFileService

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
      throw new NotFoundException(
        `Laporan Yantek dengan ID ${createPenyambunganDto.laporan_yante_id} tidak ditemukan.`,
      );
    }

    if (laporanYantek.status_laporan === StatusLaporan.SELESAI) {
      throw new ConflictException(
        `Laporan Yantek dengan ID ${createPenyambunganDto.laporan_yante_id} sudah selesai.`,
      );
    }

    // Check if penyambungan report already exists for this yantek report
    const existingPenyambungan =
      await this.prisma.laporanPenyambungan.findUnique({
        where: { laporan_yante_id: createPenyambunganDto.laporan_yante_id },
      });
    if (existingPenyambungan) {
      throw new ConflictException(
        `Laporan Penyambungan untuk Laporan Yantek ID ${createPenyambunganDto.laporan_yante_id} sudah ada.`,
      );
    }

    // 3. Process and store files
    let fotoPemasanganPath: string | undefined;
    let fotoRumahPath: string | undefined;
    let fotoPetugasPath: string | undefined;
    let fotoBaPath: string | undefined;

    try {
      [fotoPemasanganPath, fotoRumahPath, fotoPetugasPath, fotoBaPath] =
        await Promise.all([
          this.reportFileService.processAndSaveImage(
            files.foto_pemasangan_meter[0],
            'penyambungan_meter',
          ),
          this.reportFileService.processAndSaveImage(
            files.foto_rumah_pelanggan[0],
            'penyambungan_rumah',
          ),
          this.reportFileService.processAndSaveImage(
            files.foto_petugas[0],
            'petugas',
          ),
          this.reportFileService.processAndSaveImage(
            files.foto_ba_pemasangan[0],
            'penyambungan_ba',
          ),
        ]);

      // 4. Perform database operations in a transaction
      let result; // Declare result outside transaction scope
      try {
        result = await this.prisma.$transaction(async (tx) => {
          // Use tx for transaction client
          // Generate ID within the transaction
          const id = await this.reportIdService.getNextId('PS', tx); // Pass transaction client

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
        if (userId && result) {
          // Check if transaction was successful and result exists
          await this.activityLogsService
            .createLog({
              activityType: ActivityType.REPORT_COMPLETED,
              createdYantekReportId: createPenyambunganDto.laporan_yante_id,
              createdPenyambunganReportId: result.id, // Use ID from transaction result
              createdByUserId: userId,
              message: `Laporan [${createPenyambunganDto.laporan_yante_id}] diselesaikan via penyambungan [${result.id}].`,
            })
            .catch((logError) => {
              // Log error but don't fail the whole operation if logging fails
              this.logger.error(
                `Failed to create activity log for Penyambungan completion ${result?.id}:`,
                logError,
              );
            });
        }

        return {
          status: 201,
          message: 'Laporan Penyambungan berhasil dibuat',
          data: result,
        };
      } catch (error) {
        // Clean up stored files if transaction or logging fails
        this.logger.error(
          'Error during Penyambungan creation transaction or logging:',
          error,
        );
        await Promise.all([
          fotoPemasanganPath
            ? this.storageService
                .deleteFile(fotoPemasanganPath)
                .catch((e) =>
                  this.logger.warn(
                    `Cleanup failed for ${fotoPemasanganPath}: ${e}`,
                  ),
                )
            : Promise.resolve(),
          fotoRumahPath
            ? this.storageService
                .deleteFile(fotoRumahPath)
                .catch((e) =>
                  this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`),
                )
            : Promise.resolve(),
          fotoPetugasPath
            ? this.storageService
                .deleteFile(fotoPetugasPath)
                .catch((e) =>
                  this.logger.warn(
                    `Cleanup failed for ${fotoPetugasPath}: ${e}`,
                  ),
                )
            : Promise.resolve(),
          fotoBaPath
            ? this.storageService
                .deleteFile(fotoBaPath)
                .catch((e) =>
                  this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`),
                )
            : Promise.resolve(),
        ]);
        // Re-throw the original error after cleanup attempt
        throw error;
      }
    } catch (error) {
      // This outer catch handles errors from file processing before the transaction
      this.logger.error(
        'Error processing Penyambungan files before transaction:',
        error,
      );
      // Attempt cleanup even if file processing failed partially
      await Promise.all([
        fotoPemasanganPath
          ? this.storageService
              .deleteFile(fotoPemasanganPath)
              .catch((e) =>
                this.logger.warn(
                  `Cleanup failed for ${fotoPemasanganPath}: ${e}`,
                ),
              )
          : Promise.resolve(),
        fotoRumahPath
          ? this.storageService
              .deleteFile(fotoRumahPath)
              .catch((e) =>
                this.logger.warn(`Cleanup failed for ${fotoRumahPath}: ${e}`),
              )
          : Promise.resolve(),
        fotoPetugasPath
          ? this.storageService
              .deleteFile(fotoPetugasPath)
              .catch((e) =>
                this.logger.warn(`Cleanup failed for ${fotoPetugasPath}: ${e}`),
              )
          : Promise.resolve(),
        fotoBaPath
          ? this.storageService
              .deleteFile(fotoBaPath)
              .catch((e) =>
                this.logger.warn(`Cleanup failed for ${fotoBaPath}: ${e}`),
              )
          : Promise.resolve(),
      ]);
      throw error; // Re-throw the file processing error
    }
  }

  async FindActiveReport(
    paginationQuery: PaginationQueryDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    const { page = 1, limit = 10, status } = paginationQuery;
    const skip = (page - 1) * limit;

    // Base filter by status
    const baseWhere: Prisma.LaporanYantekWhereInput = {
      status_laporan: status
        ? status
        : { in: [StatusLaporan.BARU, StatusLaporan.DIPROSES] },
    };

    // Role-based filter pushed into DB
    let where: Prisma.LaporanYantekWhereInput = { ...baseWhere };
    if (userRole === UserRole.PETUGAS_YANTEK && userId) {
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_CREATED,
          createdByUserId: userId,
        },
        select: { createdYantekReportId: true },
      });
      const allowedIds = userLogs
        .map((l) => l.createdYantekReportId)
        .filter(Boolean) as string[];
      if (allowedIds.length === 0) {
        return { data: [], meta: buildMeta(0, page, limit, 0) };
      }
      where = { ...where, id: { in: allowedIds } };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.laporanYantek.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.laporanYantek.count({ where }),
    ]);

    return { data, meta: buildMeta(totalItems, page, limit, data.length) };
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
    this.logger.log(
      `Attempting to remove report ${id}, initiated by userId: ${userId}`,
    ); // Log entry point
    const report = await this.findOne(id);
    // Also prepare to delete files belonging to related LaporanPenyambungan (if any)
    const penyambunganRecords = await this.prisma.laporanPenyambungan.findMany({
      where: { laporan_yante_id: id },
      select: {
        id: true,
        foto_pemasangan_meter: true,
        foto_rumah_pelanggan: true,
        foto_petugas: true,
        foto_ba_pemasangan: true,
      },
    });

    try {
      // Use transaction to ensure related data deletion happens together
      // Note: Log creation and DB deletions are atomic within this transaction
      const deletedReport = await this.prisma.$transaction(async (prisma) => {
        // Create deletion activity log (only if userId provided)
        if (userId) {
          await prisma.activityLog.create({
            data: {
              activityType: ActivityType.REPORT_DELETED,
              createdYantekReportId: id,
              deletedReportId: id,
              createdByUserId: userId,
              message: `Laporan Yantek [${id}] dihapus.`,
            },
          });
        }

        // First delete the related LaporanPenyambungan if it exists
        await prisma.laporanPenyambungan.deleteMany({
          where: { laporan_yante_id: id },
        });

        // Then delete the LaporanYantek
        return await prisma.laporanYantek.delete({
          where: { id },
        });
      });

      // After successful DB deletion, proceed to delete files (best-effort)
      const fileDeletionResults = await Promise.all([
        this.storageService.deleteFile(report.foto_rumah),
        this.storageService.deleteFile(report.foto_meter_rusak),
        this.storageService.deleteFile(report.foto_petugas),
        this.storageService.deleteFile(report.foto_ba_gangguan),
      ]);

      // Log any file deletion issues
      fileDeletionResults.forEach((result, index) => {
        if ((result as any).error) {
          const fileType = [
            'foto_rumah',
            'foto_meter_rusak',
            'foto_petugas',
            'foto_ba_gangguan',
          ][index];
          this.logger.warn(
            `Issue deleting ${fileType} for report ${id}: ${(result as any).error}`,
          );
        }
      });

      if (penyambunganRecords.length > 0) {
        const tasks: {
          path: string | null;
          label: string;
          penyambunganId: string;
        }[] = [];
        for (const rec of penyambunganRecords) {
          tasks.push(
            {
              path: rec.foto_pemasangan_meter,
              label: 'penyambungan.foto_pemasangan_meter',
              penyambunganId: rec.id,
            },
            {
              path: rec.foto_rumah_pelanggan,
              label: 'penyambungan.foto_rumah_pelanggan',
              penyambunganId: rec.id,
            },
            {
              path: rec.foto_petugas,
              label: 'penyambungan.foto_petugas',
              penyambunganId: rec.id,
            },
            {
              path: rec.foto_ba_pemasangan,
              label: 'penyambungan.foto_ba_pemasangan',
              penyambunganId: rec.id,
            },
          );
        }

        const deletionResults = await Promise.all(
          tasks.map((t) =>
            t.path
              ? this.storageService.deleteFile(t.path)
              : Promise.resolve({ success: true }),
          ),
        );

        deletionResults.forEach((res, i) => {
          if ((res as any).error) {
            const t = tasks[i];
            this.logger.warn(
              `Issue deleting ${t.label} for penyambungan ${t.penyambunganId} (yantek ${id}): ${(res as any).error}`,
            );
          }
        });
      }

      this.logger.log(`Successfully deleted report ${id}.`);
      return {
        status: 200,
        message: 'Laporan berhasil dihapus',
        data: { id: deletedReport.id },
      };
    } catch (error) {
      this.logger.error(
        `Error during database deletion for report ${id}:`,
        error,
      );
      throw new InternalServerErrorException('Gagal menghapus laporan.');
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateReportStatusDto,
    userId?: string,
  ): Promise<any> {
    const report = await this.prisma.laporanYantek.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(
        `Laporan Yantek dengan ID ${id} tidak ditemukan.`,
      );
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

    const shouldLogCompletion =
      newStatus === StatusLaporan.SELESAI &&
      previousStatus !== StatusLaporan.SELESAI;
    const shouldLogProcessing =
      newStatus === StatusLaporan.DIPROSES &&
      previousStatus !== StatusLaporan.DIPROSES;
    const shouldLogGenericUpdate = !shouldLogCompletion && !shouldLogProcessing;

    try {
      const updatedReport = await this.prisma.laporanYantek.update({
        where: { id },
        data: { status_laporan: newStatus },
      });

      // Log based on status transition
      if (userId) {
        // Only log if user is known
        if (shouldLogCompletion) {
          await this.activityLogsService
            .createLog({
              activityType: ActivityType.REPORT_COMPLETED,
              createdYantekReportId: id,
              createdByUserId: userId,
              message: `Laporan [${id}] status diubah menjadi SELESAI (dari ${previousStatus}).`,
            })
            .catch((logError) => {
              this.logger.error(`Failed log completion for ${id}:`, logError);
            });
        } else if (shouldLogProcessing) {
          await this.activityLogsService
            .createLog({
              activityType: ActivityType.REPORT_PROCESSED,
              createdYantekReportId: id,
              createdByUserId: userId,
              message: `Laporan [${id}] status diubah menjadi DIPROSES (dari ${previousStatus}).`,
            })
            .catch((logError) => {
              this.logger.error(`Failed log processing for ${id}:`, logError);
            });
        } else if (shouldLogGenericUpdate) {
          await this.activityLogsService
            .createLog({
              activityType: ActivityType.REPORT_UPDATED,
              createdYantekReportId: id,
              createdByUserId: userId,
              message: `Laporan [${id}] status diubah dari ${previousStatus} menjadi ${newStatus}.`,
            })
            .catch((logError) => {
              this.logger.error(
                `Failed log status update for ${id}:`,
                logError,
              );
            });
        }
      }

      return {
        status: 200, // Use 200 OK for successful updates
        message: 'Status laporan berhasil diperbarui',
        data: updatedReport,
      };
    } catch (error) {
      this.logger.error(`Error updating status for report ${id}:`, error);
      throw new InternalServerErrorException(
        'Gagal memperbarui status laporan.',
      );
    }
  }

  async findHistory(
    paginationQuery: PaginationQueryDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    // Base where: only completed Yantek that have penyambungan
    let where: Prisma.LaporanYantekWhereInput = {
      status_laporan: StatusLaporan.SELESAI,
      NOT: { laporan_penyambungan: null },
    };

    // Role-based filter pushed into DB
    if (userRole === UserRole.PETUGAS_YANTEK && userId) {
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_CREATED,
          createdByUserId: userId,
        },
        select: { createdYantekReportId: true },
      });
      const allowedIds = userLogs
        .map((l) => l.createdYantekReportId)
        .filter(Boolean) as string[];
      if (allowedIds.length === 0) {
        return { data: [], meta: buildMeta(0, page, limit, 0) };
      }
      where = { ...where, id: { in: allowedIds } };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.laporanYantek.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          laporan_penyambungan: {
            select: {
              createdAt: true,
              nama_petugas: true,
              foto_pemasangan_meter: true,
              foto_rumah_pelanggan: true,
              foto_ba_pemasangan: true,
              foto_petugas: true,
              status_laporan: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.laporanYantek.count({ where }),
    ]);

    return { data, meta: buildMeta(totalItems, page, limit, data.length) };
  }

  async findYantekHistoryForPetugas(
    paginationQuery: PaginationQueryDto,
    userFullname: string,
  ) {
    // Changed userId to userFullname
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
        include: {
          laporan_penyambungan: {
            select: {
              createdAt: true,
              nama_petugas: true,
              foto_pemasangan_meter: true,
              foto_rumah_pelanggan: true,
              foto_ba_pemasangan: true,
              foto_petugas: true,
              status_laporan: true,
            },
          },
        },
        skip: skip,
        take: limit,
      }),
      this.prisma.laporanYantek.count({
        where: {
          nama_petugas: userFullname,
          status_laporan: StatusLaporan.SELESAI,
        },
      }),
    ]);

    return {
      data,
      meta: buildMeta(totalItems, page, limit, data.length),
    };
  }

  async findPenyambunganReports(
    paginationQuery: PaginationQueryDto,
    userId?: string,
    userRole?: UserRole,
  ) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    let where: Prisma.LaporanPenyambunganWhereInput = {};
    if (userRole === UserRole.PETUGAS_PENYAMBUNGAN && userId) {
      const userLogs = await this.prisma.activityLog.findMany({
        where: {
          activityType: ActivityType.REPORT_COMPLETED,
          createdByUserId: userId,
        },
        select: { createdPenyambunganReportId: true },
      });
      const allowedIds = userLogs
        .map((l) => l.createdPenyambunganReportId)
        .filter(Boolean) as string[];
      if (allowedIds.length === 0) {
        return { data: [], meta: buildMeta(0, page, limit, 0) };
      }
      where = { id: { in: allowedIds } };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.laporanPenyambungan.findMany({
        where,
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
        skip,
        take: limit,
      }),
      this.prisma.laporanPenyambungan.count({ where }),
    ]);

    return { data, meta: buildMeta(totalItems, page, limit, data.length) };
  }

  async findPenyambunganHistoryForPetugas(
    paginationQuery: PaginationQueryDto,
    userId: string,
  ) {
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
      .map((log) => log.createdPenyambunganReportId)
      .filter((id) => id !== null) as string[];

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
        include: {
          // Include details of the related LaporanYantek
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

    return {
      data,
      meta: buildMeta(totalItems, page, limit, data.length),
    };
  }
}
