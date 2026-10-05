import { BadRequestException } from '@nestjs/common';
import {
  imageUploadOptions,
  LOGO_IMAGE_MIMES,
  RASTER_IMAGE_MIMES,
} from '../../../src/shared/infrastructure/nest/image-upload-options';

function filter(options: ReturnType<typeof imageUploadOptions>, mimetype: string): { error: Error | null; accepted: boolean } {
  let result = { error: null as Error | null, accepted: false };
  options.fileFilter!({} as never, { mimetype } as Express.Multer.File, (error: Error | null, accepted?: boolean) => {
    result = { error, accepted: !!accepted };
  });
  return result;
}

describe('imageUploadOptions', () => {
  it('caps the size while streaming, so an oversized upload is not buffered whole', () => {
    // Before, avatar/logo handlers checked file.size only after multer had read the entire body into memory.
    const options = imageUploadOptions(1024 * 1024, RASTER_IMAGE_MIMES);
    expect(options.limits).toEqual({ fileSize: 1024 * 1024, files: 1 });
  });

  it('refuses a type outside the allowlist before reading the file', () => {
    const result = filter(imageUploadOptions(1024, RASTER_IMAGE_MIMES), 'text/html');
    expect(result.accepted).toBe(false);
    expect(result.error).toBeInstanceOf(BadRequestException);
  });

  it('keeps SVG out of avatars but allows it for logos', () => {
    expect(filter(imageUploadOptions(1024, RASTER_IMAGE_MIMES), 'image/svg+xml').accepted).toBe(false);
    expect(filter(imageUploadOptions(1024, LOGO_IMAGE_MIMES), 'image/svg+xml').accepted).toBe(true);
  });

  it('accepts PNG, JPEG and WebP', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(filter(imageUploadOptions(1024, RASTER_IMAGE_MIMES), mime)).toEqual({ error: null, accepted: true });
    }
  });
});
