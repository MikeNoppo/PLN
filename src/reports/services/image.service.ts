import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

@Injectable()
export class ImageService {
  async compressImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Compress image while maintaining quality
      const compressedImageBuffer = await sharp(buffer)
        .jpeg({
          quality: 80,
          mozjpeg: true,
        })
        .withMetadata() // Preserve image metadata
        .toBuffer();

      return compressedImageBuffer;
    } catch (error) {
      throw new Error(`Error compressing image: ${error.message}`);
    }
  }

  async getImageInfo(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      throw new Error(`Error getting image info: ${error.message}`);
    }
  }

  async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await this.getImageInfo(buffer);
      const validFormats = ['jpeg', 'jpg', 'png'];
      
      return validFormats.includes(metadata.format);
    } catch {
      return false;
    }
  }
}
