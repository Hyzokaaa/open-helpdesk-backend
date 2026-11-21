/** A file attached to a ticket or reply, as a notice knows it. */
export interface MatrixNoticeFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

/** Where the files of a ticket or reply come from, and their bytes. */
export interface MatrixFileSource {
  /** The files of the ticket itself (commentId null) or of one of its replies. */
  list(ticketId: string, commentId: string | null): Promise<MatrixNoticeFile[]>;
  read(file: MatrixNoticeFile): Promise<Buffer>;
}

/** Most files one notice carries; the rest are only counted. */
export const MATRIX_MAX_FILES = 4;
/** Largest file a notice carries. */
export const MATRIX_MAX_FILE_BYTES = 10 * 1024 * 1024;

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/rtf',
  'text/plain',
  'text/csv',
  'text/rtf',
]);
const DOCUMENT_PREFIXES = ['application/vnd.openxmlformats-officedocument.', 'application/vnd.oasis.opendocument.'];

export type MatrixFileKind = 'image' | 'document';

/** Images and documents travel to the room; videos, sound and anything else stay in the ticket. */
export function matrixFileKind(mimeType: string): MatrixFileKind | null {
  const type = mimeType.toLowerCase().split(';')[0].trim();
  // An SVG can carry scripts: it goes as a plain file, never shown inline
  if (type.startsWith('image/')) return type === 'image/svg+xml' ? 'document' : 'image';
  if (DOCUMENT_TYPES.has(type) || DOCUMENT_PREFIXES.some((prefix) => type.startsWith(prefix))) return 'document';
  return null;
}

/**
 * The files a notice carries: the first images and documents, up to the count limit. Those over
 * the size limit take their place too, to be told as not sent rather than silently left out.
 */
export function matrixFilesToSend(files: MatrixNoticeFile[]): { send: MatrixNoticeFile[]; tooLarge: MatrixNoticeFile[] } {
  const chosen = files.filter((file) => matrixFileKind(file.mimeType) !== null).slice(0, MATRIX_MAX_FILES);
  return {
    send: chosen.filter((file) => file.size <= MATRIX_MAX_FILE_BYTES),
    tooLarge: chosen.filter((file) => file.size > MATRIX_MAX_FILE_BYTES),
  };
}
