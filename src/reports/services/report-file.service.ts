import { Injectable } from '@nestjs/common';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

export type ReportImageType =
  | 'house'
  | 'meter'
  | 'document'
  | 'petugas'
  | 'penyambungan_meter'
  | 'penyambungan_rumah'
  | 'penyambungan_ba';

@Injectable()
export class ReportFileService {
  private readonly MAX_SIZE_WITHOUT_COMPRESSION = 50 * 1024 * 1024; // 50MB

  constructor(
    private readonly storageService: StorageService,
    private readonly imageService: ImageService,
  ) {}

  async processAndSaveImage(
    file: Express.Multer.File,
    type: ReportImageType,
  ): Promise<string> {
    let imageBuffer: Buffer;

    if (file.size > this.MAX_SIZE_WITHOUT_COMPRESSION) {
      imageBuffer = await this.imageService.compressImage(file.buffer);
    } else {
      imageBuffer = file.buffer;
    }

    return this.storageService.saveFile(imageBuffer, type, file.originalname);
  }
}
