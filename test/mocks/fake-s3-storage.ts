import { Readable } from 'stream';
import { StorageService, StoredObjectInfo } from '../../src/shared/domain/storage-service';

export class FakeS3Storage implements StorageService {
  private files: Map<string, Buffer> = new Map();
  /** Every key written, in order, including ones deleted later. */
  readonly uploadedKeys: string[] = [];
  readonly deletedKeys: string[] = [];
  /** Keys whose delete fails, to exercise best-effort cleanup. */
  readonly failingDeletes = new Set<string>();

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<void> {
    this.files.set(key, buffer);
    this.uploadedKeys.push(key);
  }

  async putStream(key: string, stream: Readable, _mimeType: string, size: number): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== size) throw new Error(`Stream ended after ${bytes.length} of ${size} bytes`);
    this.files.set(key, bytes);
    this.uploadedKeys.push(key);
  }

  async getStream(key: string): Promise<Readable> {
    const bytes = this.files.get(key);
    if (!bytes) throw new Error(`No such key: ${key}`);
    return Readable.from([bytes]);
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    const bytes = this.files.get(key);
    return bytes ? { size: bytes.length } : null;
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);
    if (this.failingDeletes.has(key)) throw new Error(`delete failed: ${key}`);
    this.files.delete(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    return `https://fake-s3.com/${key}`;
  }

  hasFile(key: string): boolean {
    return this.files.has(key);
  }

  read(key: string): Buffer | undefined {
    return this.files.get(key);
  }

  keys(): string[] {
    return [...this.files.keys()];
  }
}
