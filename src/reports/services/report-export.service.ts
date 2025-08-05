import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ExportFilterDto } from '../dto/export-filter.dto';
import * as ExcelJS from 'exceljs';
import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { TipeMeter } from '@prisma/client'; // Import necessary enums/types
import * as fs from 'fs';
import * as path from 'path';

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
            foto_petugas: true,
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
      worksheet.mergeCells('A1:P1'); // Adjusted merge range for new columns
      worksheet.getCell('A1').value = 'Laporan Yantek dan Penyambungan';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      worksheet.addRow([]); // Add empty row for spacing

      // --- Header Row ---
      const headerRow = worksheet.addRow([
        'No', 'ID Laporan', 'IDPEL', 'Nomor Meter', 'Tipe Meter', 'Tgl Lap. Yantek', 'Tgl Lap. Penyambungan',
        'Petugas Yantek', 'Petugas Penyambungan', 'Foto Rumah', 'Foto Meter Rusak', 'Foto Petugas Yantek',
        'Foto BA Gangguan', 'Foto Pasang Meter', 'Foto Rumah Pelanggan', 'Foto Petugas Penyambungan', 'Foto BA Pasang',
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
      // Ganti: gunakan process.cwd() agar path selalu ke root project
      const uploadsDir = path.resolve(process.cwd(), 'uploads/reports');

      // Helper to get image buffer and extension
      const getImageBuffer = (relativePath: string | null | undefined) => {
        if (!relativePath) {
          return null;
        }
        // Standarisasi path: ganti backslash ke slash
        const safePath = relativePath.replace(/\\/g, '/').replace(/\//g, '/');
        const absPath = path.join(uploadsDir, safePath);
        if (!fs.existsSync(absPath)) {
          return null;
        }
        let ext = path.extname(absPath).replace('.', '').toLowerCase();
        if (ext === 'jpg') ext = 'jpeg';
        if (!['jpeg', 'png', 'gif'].includes(ext)) {
          return null;
        }
        const buffer = fs.readFileSync(absPath);
        return { buffer, extension: ext as 'jpeg' | 'png' | 'gif' };
      };

      // Set column width untuk kolom gambar (J=10, K=11, dst)
      [10, 11, 12, 13, 14, 15, 16, 17].forEach((colIdx) => {
        worksheet.getColumn(colIdx).width = 25;
      });

      // Start from row 4 (karena judul + header + 1 baris kosong)
      let excelRow = 4;

      reports.forEach((report, index) => {
        const penyambungan = report.laporan_penyambungan;

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

        // Add row with placeholders for images
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
          '', // Foto Rumah
          '', // Foto Meter Rusak
          '', // Foto Petugas Yantek
          '', // Foto BA Gangguan
          '', // Foto Pasang Meter
          '', // Foto Rumah Pelanggan
          '', // Foto Petugas Penyambungan
          '', // Foto BA Pasang
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
        row.getCell(18).alignment = { vertical: 'top', horizontal: 'center' };

        // Set row height agar gambar muat thumbnail
        worksheet.getRow(excelRow).height = 100; 

        // Embed images (J=10, K=11, L=12, M=13, N=14, O=15, P=16, Q=17)
        const imageFields = [
          report.foto_rumah,
          report.foto_meter_rusak,
          report.foto_petugas,
          report.foto_ba_gangguan,
          penyambungan?.foto_pemasangan_meter,
          penyambungan?.foto_rumah_pelanggan,
          penyambungan?.foto_petugas,
          penyambungan?.foto_ba_pemasangan,
        ];
        imageFields.forEach((imgPath, i) => {
          const img = getImageBuffer(imgPath);
          if (img) {
            try {
              const imageId = workbook.addImage({ buffer: img.buffer, extension: img.extension });
              const colIdx = 9 + i;
              const rowIdx = excelRow - 1;
              worksheet.addImage(imageId, {
                tl: { col: colIdx, row: rowIdx },
                ext: { width: 100, height: 100 },
                editAs: 'oneCell',
              });
              row.getCell(10 + i).alignment = { vertical: 'middle', horizontal: 'center' };
            } catch (err) {
              row.getCell(10 + i).value = '-';
              row.getCell(10 + i).alignment = { vertical: 'middle', horizontal: 'center' };
            }
          } else {
            row.getCell(10 + i).value = '-';
            row.getCell(10 + i).alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
        excelRow++;
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
        { key: 'fotoRumah', width: 20 },
        { key: 'fotoMeterRusak', width: 20 },
        { key: 'fotoPetugasYantek', width: 20 },
        { key: 'fotoBaGangguan', width: 20 },
        { key: 'fotoPasangMeter', width: 20 },
        { key: 'fotoRumahPelanggan', width: 20 },
        { key: 'fotoPetugasPenyambungan', width: 20 },
        { key: 'fotoBaPasang', width: 20 },
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
