import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { StatusLaporan } from '@prisma/client';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number) // Otomatis mengkonversi string ke number
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(StatusLaporan)
  status?: StatusLaporan;
}
