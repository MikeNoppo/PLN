import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = 'uploads/reports';
  private readonly subDirs = {
    house: 'house-photos',
    meter: 'meter-photos',
    document: 'documents',
    petugas: 'petugas-photos',
    penyambungan_meter: 'penyambungan-meter',
    penyambungan_rumah: 'penyambungan-rumah',
    penyambungan_ba: 'penyambungan-ba',
  };

  constructor() {
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });

      for (const dir of Object.values(this.subDirs)) {
        await fs.mkdir(path.join(this.uploadDir, dir), { recursive: true });
      }
    } catch (error) {
      this.logger.error('Error creating directories:', error);
      throw new Error('Failed to initialize storage directories');
    }
  }

  async saveFile(
    file: Buffer,
    type:
      | 'house'
      | 'meter'
      | 'document'
      | 'petugas'
      | 'penyambungan_meter'
      | 'penyambungan_rumah'
      | 'penyambungan_ba',
    originalName: string,
  ): Promise<string> {
    try {
      const ext = path.extname(originalName);
      const filename = `${uuidv4()}${ext}`;
      const subDir = this.subDirs[type];
      const filePath = path.join(this.uploadDir, subDir, filename);

      await fs.writeFile(filePath, file);

      return path.join(subDir, filename);
    } catch (error) {
      this.logger.error('Error saving file:', error);
      throw new Error('Failed to save file');
    }
  }

  async deleteFile(
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!filePath) {
        return { success: true };
      }

      const fullPath = path.join(this.uploadDir, filePath);

      // Check if file exists before attempting to delete
      try {
        await fs.access(fullPath);
      } catch (error) {
        this.logger.warn(`File not found: ${fullPath}`);
        return {
          success: true,
          error: `File not found: ${filePath}`,
        };
      }

      await fs.unlink(fullPath);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.uploadDir, filePath));
      return true;
    } catch {
      return false;
    }
  }

  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }
}
