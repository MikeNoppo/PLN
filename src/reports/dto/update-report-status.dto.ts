import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatusLaporan } from '@prisma/client';

export class UpdateReportStatusDto {
  @IsNotEmpty()
  @IsEnum(StatusLaporan)
  status_laporan: StatusLaporan;
}
