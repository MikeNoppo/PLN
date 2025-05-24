import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityType, Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async createLog(data: {
    activityType: ActivityType;
    message?: string;
    createdByUserId?: string;
    createdYantekReportId?: string;
    createdPenyambunganReportId?: string;
    deletedReportId?: string; // <--- tambahkan properti baru
  }) {
    return this.prisma.activityLog.create({
      data: {
        activityType: data.activityType,
        message: data.message,
        createdByUserId: data.createdByUserId,
        createdYantekReportId: data.createdYantekReportId,
        createdPenyambunganReportId: data.createdPenyambunganReportId,
        deletedReportId: data.deletedReportId, 
      },
    });
  }

  // Method to get recent activities will be added later

  // --- Get Recent Activities --- 
  async findRecent(limit: number = 10) { // Default limit to 10
    const relevantTypes = [
      ActivityType.REPORT_CREATED,
      ActivityType.REPORT_COMPLETED,
      ActivityType.REPORT_PROCESSED,
      ActivityType.REPORT_DELETED,
    ];

    const logs = await this.prisma.activityLog.findMany({
      where: {
        activityType: {
          in: relevantTypes, // Filter by relevant types
        },
      },
      orderBy: {
        timestamp: 'desc', // Newest first
      },
      take: limit, // Apply the limit

    });

    return logs;
  }
}
