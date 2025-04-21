import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ReportExportService } from './services/report-export.service';
import { ReportSummaryService } from './services/report-summary.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: configService.get<number>('MAX_FILE_SIZE', 5) * 1024 * 1024, 
        },
      }),
      inject: [ConfigService],
    }),
    ActivityLogsModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ImageService,
    StorageService,
    ReportExportService,
    ReportSummaryService,
  ],
  exports: [
    ReportsService,
    ReportExportService,
    ReportSummaryService,
  ],
})
export class ReportsModule {}
