import type { Readable } from 'node:stream';

/** What storage knows about a stored object without reading it. */
export interface StoredObjectInfo {
  size: number;
}

export interface StorageService {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<void>;
  /**
   * Stores a stream of exactly `size` bytes without buffering it whole. Rejects, leaving no
   * complete object behind, if the stream fails or delivers a different number of bytes.
   */
  putStream(key: string, stream: Readable, mimeType: string, size: number): Promise<void>;
  /** The object's bytes as a stream; rejects if it does not exist. */
  getStream(key: string): Promise<Readable>;
  /** The object's size, or null if it does not exist. */
  stat(key: string): Promise<StoredObjectInfo | null>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
