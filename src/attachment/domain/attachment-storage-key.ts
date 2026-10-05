const MAX_FILE_NAME_LENGTH = 200;

/**
 * Where an attachment lives in storage. The original name is chosen by whoever uploads the
 * file, so only a cleaned, single-segment version of it reaches the key: it can never point
 * outside the attachment's own folder.
 */
export function attachmentStorageKey(attachmentId: string, originalName: string): string {
  return `attachments/${attachmentId}/${safeFileName(originalName)}`;
}

/** Keeps letters, digits, spaces, dots, dashes and underscores; keeps the end so the extension survives. */
export function safeFileName(originalName: string): string {
  const lastSegment = originalName.split(/[\\/]/).pop() ?? '';
  const cleaned = lastSegment
    .replace(/[^\p{L}\p{N} ._-]/gu, '_')
    .replace(/^[.\s]+/, '')
    .trim()
    .slice(-MAX_FILE_NAME_LENGTH);
  return cleaned || 'file';
}
