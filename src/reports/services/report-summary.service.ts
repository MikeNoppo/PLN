import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StatusLaporan } from '@prisma/client';

@Injectable()
export class ReportSummaryService {
  private readonly logger = new Logger(ReportSummaryService.name);

  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Get start and end of current month
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

    // Get start and end of previous month
    const startOfPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfPreviousMonth = startOfCurrentMonth; // End of previous month is start of current month

    try {
      const [countBaru, countDiproses, countSelesai, totalBulanIni, totalBulanLalu] = await this.prisma.$transaction([
        this.prisma.laporanYantek.count({
          where: { status_laporan: StatusLaporan.BARU },
        }),
        this.prisma.laporanYantek.count({
          where: { status_laporan: StatusLaporan.DIPROSES },
        }),
        this.prisma.laporanYantek.count({
          where: { status_laporan: StatusLaporan.SELESAI },
        }),
        this.prisma.laporanYantek.count({
          where: {
            createdAt: {
              gte: startOfCurrentMonth,
              lt: startOfNextMonth, // Use 'lt' (less than) start of next month
            },
          },
        }),
        this.prisma.laporanYantek.count({
          where: {
            createdAt: {
              gte: startOfPreviousMonth,
              lt: endOfPreviousMonth, // Use 'lt' (less than) start of current month
            },
          },
        }),
      ]);

      return {
        status: 200,
        message: 'Ringkasan laporan berhasil diambil',
        data: {
          statusCounts: {
            baru: countBaru,
            diproses: countDiproses,
            selesai: countSelesai,
          },
          monthlyReportTotals: {
            currentMonth: totalBulanIni,
            previousMonth: totalBulanLalu,
          }
        }
      };
    } catch (error) {
      this.logger.error('Error fetching report summary:', error);
      throw new InternalServerErrorException('Gagal mengambil ringkasan laporan.');
    }
  }
}
