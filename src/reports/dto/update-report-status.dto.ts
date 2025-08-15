import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusLaporan, TipeMeter } from '@prisma/client';

// DTO diperluas: sekarang bisa update status & field lain dari LaporanYantek.
// Semua field dibuat optional supaya bisa partial update.
export class UpdateReportStatusDto {
  @IsOptional()
  @IsEnum(StatusLaporan)
  status_laporan?: StatusLaporan;

  @IsOptional()
  @IsString()
  ID_Pelanggan?: string;

  @IsOptional()
  @IsString()
  nomor_meter?: string;

  @IsOptional()
  @IsEnum(TipeMeter)
  tipe_meter?: TipeMeter;

  @IsOptional()
  @IsString()
  stand_meter_cabut?: string;

  @IsOptional()
  @IsString()
  sisa_pulsa?: string;

  @IsOptional()
  @IsString()
  no_telepon_pelanggan?: string;

  @IsOptional()
  @IsString()
  nama_petugas?: string;
}
