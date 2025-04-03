import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query, 
  Res, 
  StreamableFile, 
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ExportFilterDto } from './dto/export-filter.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from '@prisma/client';
import { Response } from 'express'; 
import { SkipThrottle, Throttle } from '@nestjs/throttler';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // --- Endpoint for Yantek Report ---
  @Post('yantek')
  @Roles(UserRole.PETUGAS_YANTEK)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'foto_rumah', maxCount: 1 },
      { name: 'foto_meter_rusak', maxCount: 1 },
      { name: 'foto_ba_gangguan', maxCount: 1 },
    ])
  )
  async create(
    @Body() createReportDto: CreateReportDto,
    @UploadedFiles()
    files: {
      foto_rumah?: Express.Multer.File[];
      foto_meter_rusak?: Express.Multer.File[];
      foto_ba_gangguan?: Express.Multer.File[];
    },
  ) {
    if (!files.foto_rumah?.[0] || !files.foto_meter_rusak?.[0] || !files.foto_ba_gangguan?.[0]) {
      throw new BadRequestException('Semua foto wajib diunggah');
    }

    // Validate file types
    const validImageType = /^image\/(jpeg|jpg|png)$/;
    const allFiles = [
      { name: 'foto rumah', file: files.foto_rumah[0] },
      { name: 'foto meter rusak', file: files.foto_meter_rusak[0] },
      { name: 'foto BA gangguan', file: files.foto_ba_gangguan[0] },
    ];

    for (const { name, file } of allFiles) {
      if (!validImageType.test(file.mimetype)) {
        throw new BadRequestException(
          `File ${name} harus berupa gambar (jpg, jpeg, atau png). Tipe yang diterima: ${validImageType}, tipe yang dikirim: ${file.mimetype}`,
        );
      }
    }

    return this.reportsService.createYantek(createReportDto, files);
  }

  // --- Endpoint for Penyambungan Report ---
  @Post('penyambungan')
  @Roles(UserRole.PETUGAS_PENYAMBUNGAN)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'foto_pemasangan_meter', maxCount: 1 },
      { name: 'foto_rumah_pelanggan', maxCount: 1 },
      { name: 'foto_ba_pemasangan', maxCount: 1 },
    ]),
  )
  async createPenyambungan(
    @Body() createPenyambunganDto: CreatePenyambunganDto,
    @UploadedFiles()
    files: {
      foto_pemasangan_meter?: Express.Multer.File[];
      foto_rumah_pelanggan?: Express.Multer.File[];
      foto_ba_pemasangan?: Express.Multer.File[];
    },
  ) {
    if (
      !files.foto_pemasangan_meter?.[0] ||
      !files.foto_rumah_pelanggan?.[0] ||
      !files.foto_ba_pemasangan?.[0]
    ) {
      throw new BadRequestException('Semua foto wajib diunggah');
    }


    const validImageType = /^image\/(jpeg|jpg|png)$/;
    const allFiles = [
      { name: 'foto pemasangan meter', file: files.foto_pemasangan_meter[0] },
      { name: 'foto rumah pelanggan', file: files.foto_rumah_pelanggan[0] },
      { name: 'foto BA pemasangan', file: files.foto_ba_pemasangan[0] },
    ];

    for (const { name, file } of allFiles) {
      if (!validImageType.test(file.mimetype)) {
        throw new BadRequestException(
          `File ${name} harus berupa gambar (jpg, jpeg, atau png). Tipe yang diterima: ${validImageType}, tipe yang dikirim: ${file.mimetype}`,
        );
      }
    }

    return this.reportsService.createPenyambungan(createPenyambunganDto, files);
  }

  // --- Existing GET/DELETE Endpoints ---
  @SkipThrottle()
  @Get()
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_YANTEK)
  findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_YANTEK)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  // --- Export Endpoint ---
  @Get('export/excel')
  @Roles(UserRole.ADMIN) 
  async exportExcel(
    @Query() filterDto: ExportFilterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.exportReportsToExcel(filterDto);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Simple timestamp for filename
    const filename = `Laporan_PLN_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    return new StreamableFile(buffer);
  }

  // --- Update Status Endpoint ---
  @Patch(':id/status')
  @Roles(UserRole.ADMIN) 
  async updateStatus(
    @Param('id') id: string,
    @Body() updateReportStatusDto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, updateReportStatusDto);
  }
}
