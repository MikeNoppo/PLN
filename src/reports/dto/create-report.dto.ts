import { IsString, IsNotEmpty, IsEnum, Matches, IsOptional } from 'class-validator';
import { TipeMeter } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  ID_Pelanggan: string;

  @IsString()
  nomor_meter: string;

  @IsEnum(TipeMeter)
  tipe_meter: TipeMeter;

  @IsString()
  @Matches(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, {
    message: 'Nomor telepon tidak valid. Gunakan format nomor Indonesia'
  })
  no_telepon_pelanggan: string;

  @IsString()
  @IsNotEmpty()
  nama_petugas: string;

  @IsString()
  @IsOptional()
  stand_meter_cabut?: string;

  @IsString()
  @IsOptional()
  sisa_pulsa?: string;

  @IsString()
  @IsNotEmpty()
  titik_koordinat: string;

  @IsString()
  @IsOptional()
  keterangan?: string;
}
