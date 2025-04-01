import { IsOptional, IsNumber, IsEnum, IsString, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TipeMeter } from '@prisma/client'; // Assuming TipeMeter enum is exported from Prisma client

export class ExportFilterDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number) // Ensure transformation from string query param
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number) // Ensure transformation from string query param
  month?: number;

  @IsOptional()
  @IsEnum(TipeMeter)
  tipe_meter?: TipeMeter;

  // Assuming petugas ID is a UUID string based on User model
  @IsOptional()
  @IsUUID() 
  petugas_yantek_id?: string; 
}
