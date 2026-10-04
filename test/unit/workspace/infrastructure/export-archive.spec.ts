import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gzipSync } from 'node:zlib';
import {
  ArchiveFileSource,
  ArchiveLimits,
  decodeExportStream,
  writeExportArchive,
} from '../../../../src/workspace/infrastructure/export-archive';
import {
  createEncryptStream,
  deriveExportKey,
  encodeExport,
  ExportKeyContext,
  MSG_PASSWORD_REQUIRED,
  MSG_TOO_LARGE,
  MSG_WRONG_PASSWORD,
  STREAM_HEADER_LENGTH,
} from '../../../../src/workspace/infrastructure/export-file-codec';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

const FAST = 1_000;
const PASSWORD = 'correct horse battery';
const CHUNK = 64;
const LIMITS: ArchiveLimits = { maxTotalBytes: 50 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024 };
const MANIFEST = { version: '1.16.0', attachments: [{ id: 'a1', file: 'files/one' }] };

class Collector extends Writable {
  parts: Buffer[] = [];
  _write(chunk: Buffer, _enc: BufferEncoding, cb: () => void) {
    this.parts.push(chunk);
    cb();
  }
  bytes() {
    return Buffer.concat(this.parts);
  }
}

function source(path: string, bytes: Buffer): ArchiveFileSource {
  // Several pieces per file, so the writer sees more than one chunk from storage
  return { path, size: bytes.length, open: async () => Readable.from([bytes.subarray(0, 7), bytes.subarray(7)]) };
}

async function encode(manifest: object, files: ArchiveFileSource[], context: ExportKeyContext, chunkSize = CHUNK) {
  const out = new Collector();
  await writeExportArchive(out, manifest, files, context, { chunkSize });
  return out.bytes();
}

async function seal(plaintext: Buffer, context: ExportKeyContext) {
  const out = new Collector();
  await pipeline(Readable.from([plaintext]), createEncryptStream(context, { chunkSize: CHUNK }), out);
  return out.bytes();
}

function record(type: number, name: string, body: Buffer) {
  const nameBytes = Buffer.from(name);
  const head = Buffer.alloc(13 + nameBytes.length);
  head.writeUInt8(type, 0);
  head.writeUInt32BE(nameBytes.length, 1);
  nameBytes.copy(head, 5);
  head.writeBigUInt64BE(BigInt(body.length), 5 + nameBytes.length);
  return Buffer.concat([head, body]);
}

function chunksOf(bytes: Buffer) {
  const header = bytes.subarray(0, STREAM_HEADER_LENGTH);
  const chunks: Buffer[] = [];
  for (let i = STREAM_HEADER_LENGTH; i < bytes.length; i += CHUNK + 16) chunks.push(bytes.subarray(i, i + CHUNK + 16));
  return { header, chunks };
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a rejection');
}

describe('export archive (format v2)', () => {
  let dir: string;
  let context: ExportKeyContext;
  const decode = (bytes: Buffer, password: string | undefined = PASSWORD, limits = LIMITS) =>
    decodeExportStream(Readable.from([bytes.subarray(0, 10), bytes.subarray(10)]), password, dir, limits);

  beforeAll(async () => {
    context = await deriveExportKey(PASSWORD, undefined, FAST);
  });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ohd-test-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips the manifest and several files, one spanning many chunks', async () => {
    const big = randomBytes(5_000);
    const small = Buffer.from('hello');
    const empty = Buffer.alloc(0);
    const bytes = await encode(MANIFEST, [source('files/one', big), source('files/two', small), source('files/three', empty)], context);

    expect(bytes.subarray(0, 4).toString()).toBe('OHDX');
    expect(bytes[4]).toBe(2);
    expect(bytes.readUInt32BE(5)).toBe(FAST);
    expect(bytes.readUInt32BE(33)).toBe(CHUNK);
    expect(chunksOf(bytes).chunks.length).toBeGreaterThan(50);

    const decoded = await decode(bytes);
    expect(decoded.formatVersion).toBe(2);
    expect(decoded.data).toEqual(MANIFEST);
    expect([...decoded.files.keys()]).toEqual(['files/one', 'files/two', 'files/three']);
    expect(readFileSync(decoded.files.get('files/one')!.diskPath).equals(big)).toBe(true);
    expect(readFileSync(decoded.files.get('files/two')!.diskPath).toString()).toBe('hello');
    expect(decoded.files.get('files/three')!.size).toBe(0);
    expect(decoded.filesBytes).toBe(5_005);
  });

  it('writes with 1 MiB chunks by default', async () => {
    const out = new Collector();
    await writeExportArchive(out, MANIFEST, [], context);
    expect(out.bytes().readUInt32BE(33)).toBe(1024 * 1024);
    expect((await decode(out.bytes())).data).toEqual(MANIFEST);
  });

  it('uses a fresh nonce prefix for every file made with the same key', async () => {
    const a = await encode(MANIFEST, [], context);
    const b = await encode(MANIFEST, [], context);
    expect(a.subarray(25, 33).equals(b.subarray(25, 33))).toBe(false);
  });

  const damaged = async (bytes: Buffer) => {
    const error = await rejection(decode(bytes));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe(MSG_WRONG_PASSWORD);
  };

  it('rejects a file cut at a chunk boundary (no final chunk)', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', randomBytes(2_000))], context);
    const { header, chunks } = chunksOf(bytes);
    await damaged(Buffer.concat([header, ...chunks.slice(0, -1)]));
  });

  it('rejects a file cut inside a chunk', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', randomBytes(2_000))], context);
    await damaged(bytes.subarray(0, bytes.length - 5));
  });

  it('rejects reordered and duplicated chunks', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', randomBytes(2_000))], context);
    const { header, chunks } = chunksOf(bytes);
    await damaged(Buffer.concat([header, chunks[1], chunks[0], ...chunks.slice(2)]));
    await damaged(Buffer.concat([header, chunks[0], chunks[0], ...chunks.slice(1)]));
  });

  it('rejects a modified byte anywhere: ciphertext, tag or header', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', randomBytes(2_000))], context);
    for (const at of [STREAM_HEADER_LENGTH + 3, STREAM_HEADER_LENGTH + CHUNK + 2, bytes.length - 1, 20, 30]) {
      const copy = Buffer.from(bytes);
      copy[at] ^= 0x01;
      await damaged(copy);
    }
  });

  it('rejects a changed chunk size in the header', async () => {
    const bytes = Buffer.from(await encode(MANIFEST, [], context));
    bytes.writeUInt32BE(CHUNK * 2, 33);
    await damaged(bytes);
  });

  it('rejects a wrong password and asks for a missing one', async () => {
    const bytes = await encode(MANIFEST, [], context);
    const wrong = await rejection(decode(bytes, 'not the password at all'));
    expect(wrong.message).toBe(MSG_WRONG_PASSWORD);
    const missing = await rejection(decode(bytes, ''));
    expect(missing.message).toBe(MSG_PASSWORD_REQUIRED);
  });

  it('still reads format v1 and legacy plain JSON', async () => {
    const v1 = await encodeExport({ version: '1.15.0', tickets: [] }, PASSWORD, FAST);
    const fromV1 = await decode(v1);
    expect(fromV1).toMatchObject({ formatVersion: 1, data: { version: '1.15.0' }, filesBytes: 0 });
    expect(fromV1.files.size).toBe(0);

    const legacy = Buffer.from(JSON.stringify({ version: '1.14.0' }));
    expect(await decode(legacy, undefined)).toMatchObject({ formatVersion: 0, data: { version: '1.14.0' } });
  });

  it('refuses a file over the single-file limit', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', randomBytes(3_000))], context);
    const error = await rejection(decode(bytes, PASSWORD, { maxTotalBytes: 1_000_000, maxFileBytes: 2_000 }));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toMatch(/larger than/);
  });

  it('refuses an archive over the total limit, compressible or not', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', Buffer.alloc(3_000)), source('files/two', Buffer.alloc(3_000))], context);
    const error = await rejection(decode(bytes, PASSWORD, { maxTotalBytes: 5_000, maxFileBytes: 4_000 }));
    expect(error.message).toBe(MSG_TOO_LARGE);
  });

  it('refuses archive paths that are not files/<id>, duplicates, a missing end and data after it', async () => {
    const manifest = record(1, 'manifest.json', Buffer.from('{"version":"1.16.0"}'));
    const end = record(3, '', Buffer.alloc(0));
    const cases = [
      [manifest, record(2, 'files/../../etc', Buffer.from('x')), end],
      [manifest, record(2, '/tmp/x', Buffer.from('x')), end],
      [manifest, record(2, 'files/a', Buffer.from('x')), record(2, 'files/a', Buffer.from('y')), end],
      [manifest, record(2, 'files/a', Buffer.from('x'))],
      [manifest, end, record(2, 'files/a', Buffer.from('x'))],
      [record(2, 'files/a', Buffer.from('x')), manifest, end],
    ];
    for (const parts of cases) await damaged(await seal(gzipSync(Buffer.concat(parts)), context));
    // and the well-formed one passes
    const ok = await decode(await seal(gzipSync(Buffer.concat([manifest, record(2, 'files/a', Buffer.from('x')), end])), context));
    expect(ok.files.size).toBe(1);
  });

  it('writes decoded files only inside the decode directory', async () => {
    const bytes = await encode(MANIFEST, [source('files/one', Buffer.from('a')), source('files/two', Buffer.from('b'))], context);
    const decoded = await decode(bytes);
    for (const file of decoded.files.values()) expect(file.diskPath.startsWith(dir)).toBe(true);
    expect(readdirSync(dir).length).toBe(2);
  });

  it('fails the export when a stored file changes size while it is written', async () => {
    const out = new Collector();
    const lying: ArchiveFileSource = { path: 'files/one', size: 10, open: async () => Readable.from([Buffer.alloc(4)]) };
    await expect(writeExportArchive(out, MANIFEST, [lying], context, { chunkSize: CHUNK })).rejects.toThrow(/shrank/);
  });
});
