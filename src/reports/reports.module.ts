import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ImageService } from './services/image.service';
import { StorageService } from './services/storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: configService.get('MAX_FILE_SIZE')*1024 * 1024, // Convert MB to bytes
        },
      }),
      inject: [ConfigService],
    }),
    ActivityLogsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ImageService, StorageService],
})
export class ReportsModule {}
