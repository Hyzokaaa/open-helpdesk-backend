export interface StorageService {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<void>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
