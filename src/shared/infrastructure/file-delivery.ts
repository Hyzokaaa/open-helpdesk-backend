import { posix } from 'path';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.eml': 'message/rfc822',
};

/**
 * Types a browser may display when a stored file is opened. Anything else (HTML, SVG, scripts)
 * could run in the page that serves it, so it is always downloaded instead.
 */
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'application/pdf',
]);

export interface FileDelivery {
  contentType: string;
  inline: boolean;
  contentDisposition: string;
}

/** How a stored file is sent, decided from its key alone so every storage backend agrees. */
export function fileDelivery(key: string): FileDelivery {
  const fileName = posix.basename(key);
  const contentType = CONTENT_TYPES[posix.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
  const inline = INLINE_TYPES.has(contentType);
  return {
    contentType,
    inline,
    contentDisposition: inline ? 'inline' : attachmentDisposition(fileName),
  };
}

function attachmentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
