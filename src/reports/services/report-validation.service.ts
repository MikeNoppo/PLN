import { Injectable } from '@nestjs/common';
import { FileValidator } from '../../utils/file-validator.util';

@Injectable()
export class ReportValidationService {
  validateYantekFiles(files: {
    foto_rumah?: Express.Multer.File[];
    foto_meter_rusak?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_gangguan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, [
      'foto_rumah',
      'foto_meter_rusak',
      'foto_petugas',
      'foto_ba_gangguan',
    ]);

    const allFiles = [
      { name: 'foto rumah', file: files.foto_rumah![0] },
      { name: 'foto meter rusak', file: files.foto_meter_rusak![0] },
      { name: 'foto petugas', file: files.foto_petugas![0] },
      { name: 'foto BA gangguan', file: files.foto_ba_gangguan![0] },
    ];

    FileValidator.validateImageFiles(allFiles as any);
  }

  validatePenyambunganFiles(files: {
    foto_pemasangan_meter?: Express.Multer.File[];
    foto_rumah_pelanggan?: Express.Multer.File[];
    foto_petugas?: Express.Multer.File[];
    foto_ba_pemasangan?: Express.Multer.File[];
  }) {
    FileValidator.validateRequiredFiles(files, [
      'foto_pemasangan_meter',
      'foto_rumah_pelanggan',
      'foto_petugas',
      'foto_ba_pemasangan',
    ]);

    const allFiles = [
      { name: 'foto pemasangan meter', file: files.foto_pemasangan_meter![0] },
      { name: 'foto rumah pelanggan', file: files.foto_rumah_pelanggan![0] },
      { name: 'foto petugas', file: files.foto_petugas![0] },
      { name: 'foto BA pemasangan', file: files.foto_ba_pemasangan![0] },
    ];

    FileValidator.validateImageFiles(allFiles as any);
  }
}
