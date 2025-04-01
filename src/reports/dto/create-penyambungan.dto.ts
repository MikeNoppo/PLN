import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePenyambunganDto {
  @IsNotEmpty()
  @IsUUID()
  laporan_yante_id: string;

  @IsNotEmpty()
  @IsString()
  nama_petugas: string;
}
