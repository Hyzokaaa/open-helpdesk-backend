import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { createWriteStream, promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { StorageService, StoredObjectInfo } from '../domain/storage-service';
import { exactLength } from './exact-length';

@Injectable()
export class FilesystemStorageService implements StorageService {
  private readonly basePath: string;
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.basePath = config.get('STORAGE_PATH', './data/storage');
    this.baseUrl = config.get('FRONTEND_URL', 'http://localhost');
    this.secret = config.getOrThrow('JWT_SECRET');
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async putStream(key: string, stream: Readable, _mimeType: string, size: number): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    // Written beside the target and renamed into place, so a failed stream leaves no partial file
    const partial = `${filePath}.part-${randomBytes(6).toString('hex')}`;
    try {
      await pipeline(stream, exactLength(size), createWriteStream(partial, { flags: 'wx' }));
      await fs.rename(partial, filePath);
    } catch (error) {
      await fs.unlink(partial).catch(() => undefined);
      throw error;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const handle = await fs.open(this.resolvePath(key), 'r');
    return handle.createReadStream();
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await fs.stat(this.resolvePath(key));
      return info.isFile() ? { size: info.size } : null;
    } catch (err: any) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
      throw err;
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = this.sign(key, expires);
    return `${this.baseUrl}/api/storage/files/${key}?expires=${expires}&signature=${signature}`;
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

  /** Keys are relative paths under the storage folder; anything that would leave it is refused. */
  private resolvePath(key: string): string {
    const segments = key.split('/');
    const unsafe = segments.some((s) => s === '' || s === '.' || s === '..' || /[\\:]/.test(s));
    const root = resolve(this.basePath);
    const filePath = resolve(root, ...segments);
    if (unsafe || !filePath.startsWith(root + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return filePath;
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${key}:${expires}`)
      .digest('hex');
  }
}
