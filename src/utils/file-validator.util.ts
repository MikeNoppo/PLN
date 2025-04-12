import { BadRequestException } from '@nestjs/common';

export class FileValidator {
  private static readonly VALID_IMAGE_TYPE = /^image\/(jpeg|jpg|png)$/;

  static validateImageFiles(files: { name: string; file: Express.Multer.File }[]): void {
    for (const { name, file } of files) {
      if (!this.VALID_IMAGE_TYPE.test(file.mimetype)) {
        throw new BadRequestException(
          `File ${name} harus berupa gambar (jpg, jpeg, atau png). Tipe yang diterima: ${this.VALID_IMAGE_TYPE}, tipe yang dikirim: ${file.mimetype}`,
        );
      }
    }
  }

  static validateRequiredFiles(files: Record<string, Express.Multer.File[]>, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!files[field]?.[0]) {
        throw new BadRequestException('Semua foto wajib diunggah');
      }
    }
  }
}