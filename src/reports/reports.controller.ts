import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
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

    return this.reportsService.create(createReportDto, files);
  }

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
}
