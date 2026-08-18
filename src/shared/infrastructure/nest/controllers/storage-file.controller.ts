import { Controller, Get, Inject, NotFoundException, Param, Query, Res, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { promises as fs } from 'fs';
import { extname } from 'path';
import { Public } from '../../../nest/decorators/public.decorator';
import { FilesystemStorageService } from '../../filesystem-storage.service';
import { ConfigService } from '@nestjs/config';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.eml': 'message/rfc822',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

@Public()
@Controller('storage')
export class StorageFileController {
  private readonly isFilesystem: boolean;

  constructor(
    private readonly config: ConfigService,
    @Inject('FILESYSTEM_STORAGE') private readonly filesystemStorage: FilesystemStorageService | null,
  ) {
    this.isFilesystem = config.get('STORAGE_PROVIDER', 'filesystem') === 'filesystem';
  }

  @Get('files/:filepath(.*)')
  async serveFile(
    @Param('filepath') filepath: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    if (!this.isFilesystem || !this.filesystemStorage) {
      throw new NotFoundException();
    }

    const key = decodeURIComponent(filepath);
    if (!key) throw new NotFoundException();

    const exp = parseInt(expires, 10);
    if (!exp || !signature || !this.filesystemStorage.validateSignature(key, exp, signature)) {
      throw new ForbiddenException('Invalid or expired link');
    }

    const filePath = this.filesystemStorage.getFilePath(key);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException();
    }

    const mimeType = getMimeType(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  }
}
