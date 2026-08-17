import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { StorageService } from '../domain/storage-service';

@Injectable()
export class FilesystemStorageService implements StorageService {
  private readonly basePath: string;
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.basePath = config.get('STORAGE_PATH', './data/storage');
    this.baseUrl = config.get('FRONTEND_URL', 'http://localhost').split(',')[0].trim();
    this.secret = config.getOrThrow('JWT_SECRET');
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = this.sign(key, expires);
    const apiUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000').split(',')[0].trim();
    // Build URL pointing to the backend storage endpoint
    const backendPort = this.config.get('PORT', '3000');
    const backendUrl = process.env.VITE_API_URL || `http://localhost:${backendPort}`;
    return `${backendUrl}/storage/files/${encodeURIComponent(key)}?expires=${expires}&signature=${signature}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  getFilePath(key: string): string {
    return this.resolvePath(key);
  }

  validateSignature(key: string, expires: number, signature: string): boolean {
    if (Date.now() / 1000 > expires) return false;
    return this.sign(key, expires) === signature;
  }

  private resolvePath(key: string): string {
    return join(this.basePath, ...key.split('/'));
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${key}:${expires}`)
      .digest('hex');
  }
}
