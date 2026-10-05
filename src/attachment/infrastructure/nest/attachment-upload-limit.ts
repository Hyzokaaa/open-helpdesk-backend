import { ConfigService } from '@nestjs/config';
import { MulterModuleOptions } from '@nestjs/platform-express';

const DEFAULT_MAX_SIZE_MB = 25;

/**
 * Uploads are held in memory while they are processed, so each one is capped
 * (ATTACHMENT_MAX_SIZE_MB, 25 by default). A larger file is answered with 413.
 */
export function attachmentUploadOptions(config: ConfigService): MulterModuleOptions {
  const configured = Number(config.get('ATTACHMENT_MAX_SIZE_MB', DEFAULT_MAX_SIZE_MB));
  const maxSizeMb = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_SIZE_MB;
  return { limits: { fileSize: Math.floor(maxSizeMb * 1024 * 1024), files: 1 } };
}
