import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly uploadDir = 'uploads/reports';
  private readonly subDirs = {
    house: 'house-photos',
    meter: 'meter-photos',
    document: 'documents'
  };

  constructor() {
    // Ensure upload directories exist
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      
      // Create subdirectories
      for (const dir of Object.values(this.subDirs)) {
        await fs.mkdir(path.join(this.uploadDir, dir), { recursive: true });
      }
    } catch (error) {
      console.error('Error creating directories:', error);
      throw new Error('Failed to initialize storage directories');
    }
  }

  async saveFile(
    file: Buffer,
    type: 'house' | 'meter' | 'document',
    originalName: string
  ): Promise<string> {
    try {
      const ext = path.extname(originalName);
      const filename = `${uuidv4()}${ext}`;
      const subDir = this.subDirs[type];
      const filePath = path.join(this.uploadDir, subDir, filename);

      await fs.writeFile(filePath, file);

      // Return relative path for database storage
      return path.join(subDir, filename);
    } catch (error) {
      console.error('Error saving file:', error);
      throw new Error('Failed to save file');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }
}
