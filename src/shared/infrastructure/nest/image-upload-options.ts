import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const RASTER_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
/**
 * SVG is accepted for logos and icons only. Both storage backends deliver it as a download
 * with `nosniff` (the filesystem one also with `CSP: sandbox`), so it renders through `<img>`,
 * where scripts do not run, and never as a document on our origin.
 */
export const LOGO_IMAGE_MIMES = [...RASTER_IMAGE_MIMES, 'image/svg+xml'];

/**
 * Multer options for a single image upload: the size cap is enforced while the file streams
 * in (413 past it), so an oversized body is never buffered whole, and anything outside the
 * MIME allowlist is refused (400) before it is read.
 */
export function imageUploadOptions(maxBytes: number, allowedMimes: string[]): MulterOptions {
  return {
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (allowedMimes.includes(file.mimetype)) return callback(null, true);
      callback(new BadRequestException(`File type not allowed. Allowed: ${allowedMimes.join(', ')}`), false);
    },
  };
}
