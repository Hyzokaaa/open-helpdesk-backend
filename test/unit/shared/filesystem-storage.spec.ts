import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { Readable } from 'stream';
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

  function withConfig(extra: Record<string, string>): FilesystemStorageService {
    const values: Record<string, string> = { STORAGE_PATH: join(root, 'storage'), JWT_SECRET: 'secret', ...extra };
    const config = { get: (key: string, fallback?: string) => values[key] ?? fallback, getOrThrow: (key: string) => values[key] };
    return new FilesystemStorageService(config as any);
  }

  it('signs links under /api on the frontend origin when API_URL is not set', async () => {
    const url = await withConfig({ FRONTEND_URL: 'https://help.example.com' }).getPresignedUrl('attachments/a/f.png');
    expect(url).toMatch(/^https:\/\/help\.example\.com\/api\/storage\/files\/attachments\/a\/f\.png\?expires=\d+&signature=[0-9a-f]{64}$/);
  });

  it('signs links on API_URL without the /api prefix when it is set', async () => {
    const url = await withConfig({ FRONTEND_URL: 'https://help.example.com', API_URL: 'https://api.example.com' }).getPresignedUrl('attachments/a/f.png');
    expect(url).toMatch(/^https:\/\/api\.example\.com\/storage\/files\/attachments\/a\/f\.png\?expires=\d+&signature=[0-9a-f]{64}$/);
  });

  it('drops trailing slashes from API_URL', async () => {
    const url = await withConfig({ API_URL: 'https://api.example.com//' }).getPresignedUrl('attachments/a/f.png');
    expect(url.startsWith('https://api.example.com/storage/files/attachments/a/f.png?')).toBe(true);
  });

  it('stores files under the storage folder', async () => {
    await storage.upload(Buffer.from('x'), 'attachments/att-1/file.png', 'image/png');
    expect(storage.getFilePath('attachments/att-1/file.png')).toBe(join(root, 'storage', 'attachments', 'att-1', 'file.png'));
  });

  it('refuses keys that would reach outside the storage folder', async () => {
    for (const key of ['attachments/att-1/../../../escaped.txt', '../escaped.txt', '/etc/passwd', 'a//b', 'a/..\\..\\b', 'C:/x']) {
      await expect(storage.upload(Buffer.from('x'), key, 'text/plain')).rejects.toThrow('Invalid storage key');
    }
  });

  async function readAll(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  it('stores a stream and reads it back as a stream', async () => {
    const bytes = Buffer.alloc(300_000, 7);
    await storage.putStream('attachments/a/big.bin', Readable.from([bytes.subarray(0, 1000), bytes.subarray(1000)]), 'application/octet-stream', bytes.length);
    expect(readFileSync(storage.getFilePath('attachments/a/big.bin')).equals(bytes)).toBe(true);
    expect((await readAll(await storage.getStream('attachments/a/big.bin'))).equals(bytes)).toBe(true);
    expect(await storage.stat('attachments/a/big.bin')).toEqual({ size: bytes.length });
  });

  it('leaves no file behind when the stream is shorter or longer than declared', async () => {
    await expect(storage.putStream('attachments/a/short.bin', Readable.from([Buffer.alloc(10)]), 'x/y', 11)).rejects.toThrow();
    await expect(storage.putStream('attachments/a/long.bin', Readable.from([Buffer.alloc(12)]), 'x/y', 11)).rejects.toThrow();
    expect(readdirSync(join(root, 'storage', 'attachments', 'a'))).toEqual([]);
  });

  it('leaves no file behind when the source stream fails', async () => {
    const failing = new Readable({ read() { this.destroy(new Error('boom')); } });
    await expect(storage.putStream('attachments/a/f.bin', failing, 'x/y', 5)).rejects.toThrow('boom');
    expect(existsSync(storage.getFilePath('attachments/a/f.bin'))).toBe(false);
    expect(readdirSync(join(root, 'storage', 'attachments', 'a'))).toEqual([]);
  });

  it('reports a missing object as null and refuses to stream it', async () => {
    expect(await storage.stat('attachments/none/x.png')).toBeNull();
    await expect(storage.getStream('attachments/none/x.png')).rejects.toThrow();
  });

  it('applies the path rules to the stream methods', async () => {
    await expect(storage.getStream('../escaped.txt')).rejects.toThrow('Invalid storage key');
    await expect(storage.stat('../escaped.txt')).rejects.toThrow('Invalid storage key');
    await expect(storage.putStream('a/../../x', Readable.from([Buffer.alloc(1)]), 'x/y', 1)).rejects.toThrow('Invalid storage key');
  });
});
