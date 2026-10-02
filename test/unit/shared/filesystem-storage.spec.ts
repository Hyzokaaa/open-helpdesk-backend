import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesystemStorageService } from '../../../src/shared/infrastructure/filesystem-storage.service';

describe('FilesystemStorageService', () => {
  let root: string;
  let storage: FilesystemStorageService;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-storage-'));
    const values: Record<string, string> = { STORAGE_PATH: join(root, 'storage'), JWT_SECRET: 'secret' };
    const config = { get: (key: string, fallback?: string) => values[key] ?? fallback, getOrThrow: (key: string) => values[key] };
    storage = new FilesystemStorageService(config as any);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('stores files under the storage folder', async () => {
    await storage.upload(Buffer.from('x'), 'attachments/att-1/file.png', 'image/png');
    expect(storage.getFilePath('attachments/att-1/file.png')).toBe(join(root, 'storage', 'attachments', 'att-1', 'file.png'));
  });

  it('refuses keys that would reach outside the storage folder', async () => {
    for (const key of ['attachments/att-1/../../../escaped.txt', '../escaped.txt', '/etc/passwd', 'a//b', 'a/..\\..\\b', 'C:/x']) {
      await expect(storage.upload(Buffer.from('x'), key, 'text/plain')).rejects.toThrow('Invalid storage key');
    }
  });
});
