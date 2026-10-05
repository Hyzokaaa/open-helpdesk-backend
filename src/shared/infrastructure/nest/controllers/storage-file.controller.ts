import { Controller, Get, Inject, NotFoundException, Param, Query, Res, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { promises as fs } from 'fs';
import { Public } from '../../../nest/decorators/public.decorator';
import { FilesystemStorageService } from '../../filesystem-storage.service';
import { fileDelivery } from '../../file-delivery';
import { ConfigService } from '@nestjs/config';

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

    let filePath: string;
    try {
      filePath = this.filesystemStorage.getFilePath(key);
      await fs.access(filePath);
    } catch {
      throw new NotFoundException();
    }

    // Files are served from the app's own origin, where the session lives: only types that cannot
    // run script are displayed, everything else is downloaded, and the response may not be sniffed
    // into something else. The PDF viewer does not load in a sandboxed document, so PDFs skip it.
    const delivery = fileDelivery(key);
    res.setHeader('Content-Type', delivery.contentType);
    res.setHeader('Content-Disposition', delivery.contentDisposition);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (delivery.contentType !== 'application/pdf') {
      res.setHeader('Content-Security-Policy', 'sandbox');
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  }
}
