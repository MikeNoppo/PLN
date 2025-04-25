import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ExportFilterDto } from '../dto/export-filter.dto';
import * as ExcelJS from 'exceljs';
import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { TipeMeter } from '@prisma/client'; // Import necessary enums/types

@Injectable()
export class ReportExportService {
  constructor(
    private prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  prepareExcelResponse(buffer: Buffer, res: Response): StreamableFile {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Laporan_PLN_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    return new StreamableFile(buffer);
  }

  async exportReportsToExcel(filterDto: ExportFilterDto): Promise<Buffer> {
    const { year, month, tipe_meter, petugas_yantek_id } = filterDto;

    const whereClause: any = {}; // Use 'any' for dynamic where clause building

    if (tipe_meter) {
      // Ensure tipe_meter is a valid enum value if necessary
      if (!Object.values(TipeMeter).includes(tipe_meter)) {
          throw new NotFoundException(`Tipe meter tidak valid: ${tipe_meter}`);
      }
      whereClause.tipe_meter = tipe_meter;
    }
    if (petugas_yantek_id) {
      // Assuming nama_petugas is stored directly in LaporanYantek based on schema
      whereClause.nama_petugas = { contains: petugas_yantek_id, mode: 'insensitive' };
    }

    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1); // Month is 0-indexed
      const endDate = new Date(year, month ? month : 12, 0); // Get last day of month/year
      endDate.setHours(23, 59, 59, 999); // Ensure end date includes the whole day

      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else if (month) {
        // Handle month filter without year? Might need clarification or ignore.
        // For now, assuming month filter only works with year filter.
        console.warn("Month filter provided without year filter, ignoring month filter.");
    }


    // 2. Fetch Data
    const reports = await this.prisma.laporanYantek.findMany({
      where: whereClause,
      include: {
        laporan_penyambungan: {
          select: {
            createdAt: true,
            nama_petugas: true,
            foto_pemasangan_meter: true,
            foto_rumah_pelanggan: true,
            foto_ba_pemasangan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (reports.length === 0) {
      throw new NotFoundException('Tidak ada data laporan yang ditemukan sesuai filter.');
    }

    // 3. Generate Excel
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan PLN');

      // --- Template (Optional - Basic Title) ---
      worksheet.mergeCells('A1:N1'); // Adjusted merge range for new column
      worksheet.getCell('A1').value = 'Laporan Yantek dan Penyambungan';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      worksheet.addRow([]); // Add empty row for spacing

      // --- Header Row ---
      const headerRow = worksheet.addRow([
        'No', 'ID Laporan', 'IDPEL', 'Nomor Meter', 'Tipe Meter', 'Tgl Lap. Yantek', 'Tgl Lap. Penyambungan',
        'Petugas Yantek', 'Petugas Penyambungan', 'Foto Rumah', 'Foto Meter Rusak',
        'Foto BA Gangguan', 'Foto Pasang Meter', 'Foto Rumah Pelanggan', 'Foto BA Pasang',
        'Status Laporan', 'Keterangan' // Added Keterangan
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }, // Light grey
        };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      // --- Data Rows ---
      const baseUrl = this.configService.get<string>('APP_URL') || ''; // Get base URL or default

      reports.forEach((report, index) => {
        const penyambungan = report.laporan_penyambungan;

        // Helper to create hyperlink
        const createHyperlink = (relativePath: string | null | undefined) => {
          if (!relativePath) return '-';
          // Basic check if it's already a full URL (less likely from our storage)
          if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
             return { text: 'Lihat Foto', hyperlink: relativePath };
          }
          // Construct full URL - ensure no double slashes if baseUrl ends with / and relativePath starts with /
          const fullUrl = `${baseUrl.replace(/\/$/, '')}/uploads/reports/${relativePath.replace(/^\//, '')}`;
          return { text: 'Lihat Foto', hyperlink: fullUrl };
        };

        const formatDate = (date: Date | null | undefined) => {
            if (!date) return '-';
            // Simple YYYY-MM-DD format
            try {
                return date.toISOString().split('T')[0];
            } catch (e) {
                console.error("Error formatting date:", date, e);
                return 'Invalid Date';
            }
        }

        const row = worksheet.addRow([
          index + 1,
          report.id, // Added ID Laporan
          report.ID_Pelanggan,
          report.nomor_meter,
          report.tipe_meter, // Added Tipe Meter
          formatDate(report.createdAt),
          formatDate(penyambungan?.createdAt),
          report.nama_petugas || '-',
          penyambungan?.nama_petugas || '-',
          createHyperlink(report.foto_rumah),
          createHyperlink(report.foto_meter_rusak),
          createHyperlink(report.foto_ba_gangguan),
          createHyperlink(penyambungan?.foto_pemasangan_meter),
          createHyperlink(penyambungan?.foto_rumah_pelanggan),
          createHyperlink(penyambungan?.foto_ba_pemasangan),
          report.status_laporan,
          report.keterangan || '-', // Added Keterangan
        ]);

        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }; // Enable wrapText for data cells
        });
        // Specific alignment for No column
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
        // Specific alignment for Status Laporan
        row.getCell(16).alignment = { vertical: 'top', horizontal: 'center' };
      });

      // --- Column Widths ---
      worksheet.columns = [
        { key: 'no', width: 5 },
        { key: 'idLaporan', width: 18 }, // Added ID Laporan
        { key: 'idpel', width: 15 },
        { key: 'nomorMeter', width: 15 },
        { key: 'tipeMeter', width: 13 }, // Added Tipe Meter
        { key: 'tglYantek', width: 15 },
        { key: 'tglPenyambungan', width: 15 },
        { key: 'petugasYantek', width: 20 },
        { key: 'petugasPenyambungan', width: 20 },
        { key: 'fotoRumah', width: 15 },
        { key: 'fotoMeterRusak', width: 15 },
        { key: 'fotoBaGangguan', width: 15 },
        { key: 'fotoPasangMeter', width: 15 },
        { key: 'fotoRumahPelanggan', width: 15 },
        { key: 'fotoBaPasang', width: 15 },
        { key: 'status', width: 15 },
        { key: 'keterangan', width: 30 }, // Added Keterangan
      ];

      // 4. Generate Buffer
      return await workbook.xlsx.writeBuffer() as Buffer;

    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw new InternalServerErrorException('Gagal membuat file Excel.');
    }
  }
}
