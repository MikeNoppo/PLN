import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto'; // Assuming pagination for recent activities
import { ParseIntPipe, DefaultValuePipe } from '@nestjs/common'; // Import pipes

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get('recent')
  @Roles(UserRole.ADMIN) // Restrict to ADMIN or adjust as needed
  async findRecent(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const data = await this.activityLogsService.findRecent(limit);
    return {
      status: 200,
      message: 'Aktivitas terbaru berhasil diambil',
      data,
    };
  }

  // Endpoint for recent activities will be added later based on Step 2 instructions
}
