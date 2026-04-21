export class FakeS3Storage {
  private files: Map<string, Buffer> = new Map();

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<void> {
    this.files.set(key, buffer);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    return `https://fake-s3.com/${key}`;
  }

  hasFile(key: string): boolean {
    return this.files.has(key);
  }
}
