import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePenyambunganDto {
  @IsNotEmpty()
  @IsString()
  laporan_yante_id: string;

  @IsNotEmpty()
  @IsString()
  nama_petugas: string;
}
