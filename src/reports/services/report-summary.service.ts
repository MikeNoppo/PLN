import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StatusLaporan, TipeMeter } from '@prisma/client';
import { PeriodType } from '../dto/performance-filter.dto';

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

  async getDashboardStats() {
    try {
      const [countRusak, countOptimal, countPraBayar, countPascaBayar] = await this.prisma.$transaction([
        // Total laporan Yantek dengan status BARU atau DIPROSES (Belum Selesai = rusak)
        this.prisma.laporanYantek.count({
          where: {
            status_laporan: {
              in: [StatusLaporan.BARU, StatusLaporan.DIPROSES]
            },
          }
        }),
        // Total laporan Yantek dengan status SELESAI (Selesai = optimal)
        this.prisma.laporanYantek.count({
          where: {
            status_laporan: StatusLaporan.SELESAI
          }
        }),
        // Total laporan Yantek dengan jenis meteran PRA-BAYAR
        this.prisma.laporanYantek.count({
          where: {
            tipe_meter: TipeMeter.PRA_BAYAR
          }
        }),
        // Total laporan Yantek dengan jenis meteran PASCA-BAYAR
        this.prisma.laporanYantek.count({
          where: {
            tipe_meter: TipeMeter.PASCA_BAYAR
          }
        })
      ]);

      return {
        message: 'Data Statistik berhasil diambil',
        data:{
          meterStatus: {
            rusak: countRusak,
            optimal: countOptimal
          },
          meterTypes: {
            praBayar: countPraBayar,
            pascaBayar: countPascaBayar
          }
        }
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw new InternalServerErrorException('Gagal mengambil data statistik.');
    }
  }

  async getPerformanceStats(period: PeriodType) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      
      // Array untuk menyimpan hasil
      let labels: string[] = [];
      let data: number[] = [];

      switch(period) {
        case PeriodType.WEEKLY:
          // Data 4 minggu terakhir pada bulan berjalan
          labels = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'];
          
          // Hitung tanggal awal dan akhir setiap minggu
          const weeks = [];
          for (let i = 0; i < 4; i++) {
            const startDay = i * 7 + 1;
            const startDate = new Date(currentYear, currentMonth, startDay);
            const endDate = new Date(currentYear, currentMonth, startDay + 6);
            
            // Sesuaikan untuk minggu yang melebihi akhir bulan
            if (endDate.getMonth() > currentMonth) {
              endDate.setDate(0); // Set ke hari terakhir bulan sebelumnya
            }
            
            weeks.push({ startDate, endDate });
          }
          
          // Ambil data per minggu
          data = await Promise.all(
            weeks.map(async ({ startDate, endDate }) => {
              return await this.prisma.laporanPenyambungan.count({
                where: {
                  createdAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              });
            })
          );
          break;

        case PeriodType.MONTHLY:
          // Data 6 bulan terakhir
          labels = [];
          const monthsData = [];
          for (let i = 5; i >= 0; i--) {
            const targetMonth = (currentMonth - i + 12) % 12; // Pastikan nilai positif
            const targetYear = currentYear - Math.floor((i - currentMonth) / 12);
            
            const monthDate = new Date(targetYear, targetMonth, 1);
            labels.push(this.getMonthName(targetMonth));
            
            const startOfMonth = new Date(targetYear, targetMonth, 1);
            const endOfMonth = new Date(targetYear, targetMonth + 1, 0);
            
            monthsData.push({ startDate: startOfMonth, endDate: endOfMonth });
          }
          
          // Ambil data per bulan
          data = await Promise.all(
            monthsData.map(async ({ startDate, endDate }) => {
              return await this.prisma.laporanPenyambungan.count({
                where: {
                  createdAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              });
            })
          );
          break;

        case PeriodType.YEARLY:
          // Data 5 tahun terakhir
          labels = [];
          const yearsData = [];
          for (let i = 4; i >= 0; i--) {
            const targetYear = currentYear - i;
            labels.push(targetYear.toString());
            
            const startOfYear = new Date(targetYear, 0, 1);
            const endOfYear = new Date(targetYear, 11, 31);
            
            yearsData.push({ startDate: startOfYear, endDate: endOfYear });
          }
          
          // Ambil data per tahun
          data = await Promise.all(
            yearsData.map(async ({ startDate, endDate }) => {
              return await this.prisma.laporanPenyambungan.count({
                where: {
                  createdAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              });
            })
          );
          break;
      }

      return {
        status: 200,
        message: 'Data performa perbaikan meter berhasil diambil',
        data: {
          labels,
          data
        }
      };
    } catch (error) {
      this.logger.error('Error fetching performance stats:', error);
      throw new InternalServerErrorException('Gagal mengambil data performa.');
    }
  }

  // Helper method untuk nama bulan dalam bahasa Indonesia
  private getMonthName(monthIndex: number): string {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
      'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return months[monthIndex];
  }
}
