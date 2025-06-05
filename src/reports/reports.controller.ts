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
  UseGuards,
  Query,
  Res,
  StreamableFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service'; 
import { ReportExportService } from './services/report-export.service'; 
import { ReportSummaryService } from './services/report-summary.service'; 
import { CreateReportDto } from './dto/create-report.dto';
import { CreatePenyambunganDto } from './dto/create-penyambungan.dto';
import { ExportFilterDto } from './dto/export-filter.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { PeriodType, PerformanceFilterDto } from './dto/performance-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from '@prisma/client';
import { Response, Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../auth/decorators/user.decorator'; // Added User decorator import

// Define an interface for the expected user payload in the request
interface AuthenticatedRequest extends Request {
  user?: { id: string; [key: string]: any };
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService, 
    private readonly reportExportService: ReportExportService, 
    private readonly reportSummaryService: ReportSummaryService, 
  ) {}

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
    @Req() req: AuthenticatedRequest,
    @Body() createReportDto: CreateReportDto,
    @UploadedFiles()
    files: {
      foto_rumah?: Express.Multer.File[];
      foto_meter_rusak?: Express.Multer.File[];
      foto_ba_gangguan?: Express.Multer.File[];
    },
  ) {
    const userId = req.user?.id;
    this.reportsService.validateAndProcessYantekFiles(files);
    return this.reportsService.createYantek(createReportDto, files, userId);
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
    @Req() req: AuthenticatedRequest,
    @Body() createPenyambunganDto: CreatePenyambunganDto,
    @UploadedFiles()
    files: {
      foto_pemasangan_meter?: Express.Multer.File[];
      foto_rumah_pelanggan?: Express.Multer.File[];
      foto_ba_pemasangan?: Express.Multer.File[];
    },
  ) {
    const userId = req.user?.id;
    this.reportsService.validateAndProcessPenyambunganFiles(files);
    return this.reportsService.createPenyambungan(createPenyambunganDto, files, userId);
  }

  // --- Dashboard Endpoint ---
  @SkipThrottle()
  @Roles(UserRole.ADMIN)
  @Get('summary')
  getSummary() {
    return this.reportSummaryService.getSummary();
  }

  @SkipThrottle()
  @Roles(UserRole.ADMIN)
  @Get('dashboard-stats')
  getdashboardStats(){
    return this.reportSummaryService.getDashboardStats();
  }
  
  @SkipThrottle()
  @Get('performance-stats')
  @Roles(UserRole.ADMIN)
  getPerformanceStats(@Query() filterDto: PerformanceFilterDto) {
    return this.reportSummaryService.getPerformanceStats(filterDto.period || PeriodType.MONTHLY);
  }

  // --- Existing GET/DELETE Endpoints ---
  @SkipThrottle()
  @Get()
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_YANTEK, UserRole.PETUGAS_PENYAMBUNGAN) 
  findAll(@Req() req: AuthenticatedRequest, @Query() paginationQuery: PaginationQueryDto) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    return this.reportsService.FindActiveReport(paginationQuery, userId, userRole);
  }

  @SkipThrottle()
  @Get('penyambungan')
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_PENYAMBUNGAN)
  findPenyambungan(@Req() req: AuthenticatedRequest, @Query() paginationQuery: PaginationQueryDto) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    return this.reportsService.findPenyambunganReports(paginationQuery, userId, userRole);
  }

  @SkipThrottle()
  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_YANTEK, UserRole.PETUGAS_PENYAMBUNGAN)
  findHistory(@Req() req: AuthenticatedRequest, @Query() paginationQuery: PaginationQueryDto) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    return this.reportsService.findHistory(paginationQuery, userId, userRole);
  }

  @SkipThrottle()
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PETUGAS_YANTEK,UserRole.PETUGAS_PENYAMBUNGAN)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @SkipThrottle()
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user?.id;
    return this.reportsService.remove(id, userId);
  }

  // --- Export Endpoint ---
  @Get('export/excel')
  @Roles(UserRole.ADMIN) 
  async exportExcel(
    @Query() filterDto: ExportFilterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportExportService.exportReportsToExcel(filterDto);
    return this.reportExportService.prepareExcelResponse(buffer, res);
  }

  // --- Update Status Endpoint ---
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateReportStatusDto: UpdateReportStatusDto,
  ) {
    const userId = req.user?.id;
    return this.reportsService.updateStatus(id, updateReportStatusDto, userId);
  }

  @Get('yantek-history/petugas')
  @Roles(UserRole.PETUGAS_YANTEK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  findYantekHistoryForPetugas(
    @Query() paginationQuery: PaginationQueryDto,
    @User('name') userFullname: string, // Changed from @User('fullname') to @User('name')
  ) {
    if (!userFullname) { // Check userFullname (which now comes from req.user.name)
      throw new BadRequestException('User name is required for PETUGAS_YANTEK history.'); // Updated error message
    }
    return this.reportsService.findYantekHistoryForPetugas(paginationQuery, userFullname);
  }

  @Get('penyambungan-history/petugas')
  @Roles(UserRole.PETUGAS_PENYAMBUNGAN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  findPenyambunganHistoryForPetugas(
    @Query() paginationQuery: PaginationQueryDto,
    @User('name') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required for PETUGAS_PENYAMBUNGAN');
    }
    return this.reportsService.findPenyambunganHistoryForPetugas(paginationQuery, userId);
  }
}
