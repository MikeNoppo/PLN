import { IsOptional, IsNumber, IsEnum, IsString, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TipeMeter } from '@prisma/client';

export class ExportFilterDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number) 
  month?: number;

  @IsOptional()
  @IsEnum(TipeMeter)
  tipe_meter?: TipeMeter;

  @IsOptional()
  @IsUUID() 
  petugas_yantek_id?: string; 
}
