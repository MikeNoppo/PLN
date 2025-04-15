import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityType, Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async createLog(data: {
    activityType: ActivityType;
    message?: string;
    relatedUserId?: string;
    relatedYantekReportId?: string;
    relatedPenyambunganReportId?: string;
  }) {
    return this.prisma.activityLog.create({
      data: {
        activityType: data.activityType,
        message: data.message,
        relatedUserId: data.relatedUserId,
        relatedYantekReportId: data.relatedYantekReportId,
        relatedPenyambunganReportId: data.relatedPenyambunganReportId,
      },
    });
  }

  // Method to get recent activities will be added later

  // --- Get Recent Activities --- 
  async findRecent(limit: number = 10) { // Default limit to 10
    const relevantTypes = [
      ActivityType.REPORT_CREATED,
      ActivityType.REPORT_COMPLETED,
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
      // Optionally include related data if needed for display
      // include: {
      //   relatedUser: { select: { id: true, name: true } },
      //   relatedYantekReport: { select: { id: true } },
      //   relatedPenyambunganReport: { select: { id: true } },
      // }
    });

    return logs;
  }
}
