import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { DomainValidationError } from '../../shared/domain/errors';
import {
  createDecryptStream,
  createEncryptStream,
  decodeExport,
  deriveExportKey,
  ExportKeyContext,
  FORMAT_VERSION_STREAM,
  isEncryptedExport,
  MAX_DECOMPRESSED_BYTES,
  MSG_NOT_AN_EXPORT,
  MSG_PASSWORD_REQUIRED,
  MSG_TOO_LARGE,
  MSG_WRONG_PASSWORD,
  parseStreamHeader,
  STREAM_HEADER_LENGTH,
} from './export-file-codec';

/**
 * What a format v2 .ohd file carries once decrypted and gunzipped: a sequence of records,
 *
 *   record = type (1) | name length uint32 BE (4) | name UTF-8 | size uint64 BE (8) | size bytes
 *
 * type 1 = the manifest, always first, name "manifest.json": the export JSON (UTF-8);
 * type 2 = a file, name = the archive path the manifest refers to it by (`files/<ulid>`);
 * type 3 = end of archive, empty name and size 0, always last.
 *
 * The manifest never names storage keys: attachments and logos point at archive paths.
 */
export const RECORD_MANIFEST = 1;
export const RECORD_FILE = 2;
export const RECORD_END = 3;
export const MANIFEST_NAME = 'manifest.json';
/** The only archive paths a reader accepts, so a name can never be used as a filesystem path. */
export const ARCHIVE_PATH = /^files\/[A-Za-z0-9_-]{1,100}$/;
const MAX_NAME_LENGTH = 1024;
const RECORD_FIXED_LENGTH = 1 + 4 + 8;

const MB = 1024 * 1024;
export const DEFAULT_IMPORT_MAX_MB = 2048;
export const DEFAULT_IMPORT_MAX_FILE_MB = 512;

export interface ArchiveLimits {
  /** Ceiling on everything the archive decompresses to, manifest and files included. */
  maxTotalBytes: number;
  /** Ceiling on any single file in the archive. */
  maxFileBytes: number;
}

function megabytesFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** WORKSPACE_IMPORT_MAX_MB (default 2048) and WORKSPACE_IMPORT_MAX_FILE_MB (default 512). */
export function importLimitsFromEnv(): ArchiveLimits {
  return {
    maxTotalBytes: Math.floor(megabytesFromEnv('WORKSPACE_IMPORT_MAX_MB', DEFAULT_IMPORT_MAX_MB) * MB),
    maxFileBytes: Math.floor(megabytesFromEnv('WORKSPACE_IMPORT_MAX_FILE_MB', DEFAULT_IMPORT_MAX_FILE_MB) * MB),
  };
}

/** A file to put in an archive; opened only when its turn comes, so one is open at a time. */
export interface ArchiveFileSource {
  path: string;
  size: number;
  open(): Promise<Readable>;
}

function recordHeader(type: number, name: string, size: number): Buffer {
  const nameBytes = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(RECORD_FIXED_LENGTH + nameBytes.length);
  header.writeUInt8(type, 0);
  header.writeUInt32BE(nameBytes.length, 1);
  nameBytes.copy(header, 5);
  header.writeBigUInt64BE(BigInt(size), 5 + nameBytes.length);
  return header;
}

async function* archiveRecords(manifest: object, files: ArchiveFileSource[]): AsyncGenerator<Buffer> {
  const json = Buffer.from(JSON.stringify(manifest), 'utf8');
  yield recordHeader(RECORD_MANIFEST, MANIFEST_NAME, json.length);
  yield json;
  for (const file of files) {
    if (!ARCHIVE_PATH.test(file.path)) throw new Error(`Invalid archive path: ${file.path}`);
    yield recordHeader(RECORD_FILE, file.path, file.size);
    let written = 0;
    for await (const chunk of await file.open()) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      written += bytes.length;
      // The size is already in the record header: a file that changed meanwhile fails the export
      if (written > file.size) throw new Error(`File ${file.path} grew while it was exported`);
      yield bytes;
    }
    if (written !== file.size) throw new Error(`File ${file.path} shrank while it was exported`);
  }
  yield recordHeader(RECORD_END, '', 0);
}

/**
 * Writes a format v2 .ohd file to `output`: manifest and files, gzipped and encrypted chunk by
 * chunk, so at most one chunk of one file is in memory at a time. Rejects (and destroys `output`)
 * if anything fails midway.
 */
export async function writeExportArchive(
  output: Writable,
  manifest: object,
  files: ArchiveFileSource[],
  context: ExportKeyContext,
  options: { chunkSize?: number } = {},
): Promise<void> {
  await pipeline(Readable.from(archiveRecords(manifest, files)), createGzip(), createEncryptStream(context, options), output);
}

/** A file of a decoded archive, written to the decode directory. */
export interface DecodedArchiveFile {
  /** Where the bytes are on disk. */
  diskPath: string;
  size: number;
}

export interface DecodedExport {
  data: object;
  /** 0 for legacy plain JSON, then the .ohd format version. */
  formatVersion: number;
  /** Keyed by archive path. Empty for v1 and legacy files, which carry no files. */
  files: Map<string, DecodedArchiveFile>;
  filesBytes: number;
}

/** Reads a byte stream in exact-size pieces. */
class StreamReader {
  private readonly iterator: AsyncIterator<unknown>;
  private buffered: Buffer[] = [];
  private length = 0;
  private ended = false;

  constructor(source: AsyncIterable<unknown>) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  private async fill(): Promise<boolean> {
    if (this.ended) return false;
    const next = await this.iterator.next();
    if (next.done) {
      this.ended = true;
      return false;
    }
    const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value as Uint8Array);
    if (chunk.length) {
      this.buffered.push(chunk);
      this.length += chunk.length;
    }
    return true;
  }

  /** Exactly `size` bytes, or fewer if the stream ends first. */
  async read(size: number): Promise<Buffer> {
    while (this.length < size && (await this.fill()));
    return this.take(Math.min(size, this.length));
  }

  /** Between 1 and `max` bytes, or an empty buffer at the end. */
  async readSome(max: number): Promise<Buffer> {
    while (this.length === 0 && (await this.fill()));
    return this.take(Math.min(max, this.length));
  }

  async atEnd(): Promise<boolean> {
    while (this.length === 0 && (await this.fill()));
    return this.length === 0;
  }

  /** Everything not read yet, as a stream. */
  async *rest(): AsyncGenerator<Buffer> {
    if (this.length) yield this.take(this.length);
    for (;;) {
      if (!(await this.fill())) return;
      if (this.length) yield this.take(this.length);
    }
  }

  private take(size: number): Buffer {
    const out = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const first = this.buffered[0];
      const n = Math.min(first.length, size - offset);
      first.copy(out, offset, 0, n);
      offset += n;
      if (n === first.length) this.buffered.shift();
      else this.buffered[0] = first.subarray(n);
    }
    this.length -= size;
    return out;
  }
}

function parseManifest(bytes: Buffer): object {
  let text = bytes.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // reported below
  }
  throw new DomainValidationError(MSG_NOT_AN_EXPORT);
}

async function* bytesOf(reader: StreamReader, size: number): AsyncGenerator<Buffer> {
  let left = size;
  while (left > 0) {
    const piece = await reader.readSome(Math.min(left, 64 * 1024));
    if (!piece.length) throw new DomainValidationError(MSG_WRONG_PASSWORD);
    left -= piece.length;
    yield piece;
  }
}

/** Parses the record container, writing each file into `dir` under a name of its own choosing. */
async function readContainer(source: AsyncIterable<unknown>, dir: string, limits: ArchiveLimits): Promise<DecodedExport> {
  const reader = new StreamReader(source);
  const damaged = () => new DomainValidationError(MSG_WRONG_PASSWORD);
  const files = new Map<string, DecodedArchiveFile>();
  let total = 0;
  let filesBytes = 0;
  let data: object | null = null;
  const count = (n: number) => {
    total += n;
    if (total > limits.maxTotalBytes) throw new DomainValidationError(MSG_TOO_LARGE);
  };

  for (;;) {
    const fixed = await reader.read(5);
    if (fixed.length < 5) throw damaged();
    const type = fixed.readUInt8(0);
    const nameLength = fixed.readUInt32BE(1);
    if (nameLength > MAX_NAME_LENGTH) throw damaged();
    const rest = await reader.read(nameLength + 8);
    if (rest.length < nameLength + 8) throw damaged();
    count(RECORD_FIXED_LENGTH + nameLength);
    const name = rest.subarray(0, nameLength).toString('utf8');
    const bigSize = rest.readBigUInt64BE(nameLength);
    if (bigSize > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainValidationError(MSG_TOO_LARGE);
    const size = Number(bigSize);

    if (data === null) {
      if (type !== RECORD_MANIFEST || name !== MANIFEST_NAME) throw damaged();
      if (size > MAX_DECOMPRESSED_BYTES) throw new DomainValidationError(MSG_TOO_LARGE);
      count(size);
      const json = await reader.read(size);
      if (json.length < size) throw damaged();
      data = parseManifest(json);
      continue;
    }
    if (type === RECORD_END) {
      if (name !== '' || size !== 0 || !(await reader.atEnd())) throw damaged();
      return { data, formatVersion: FORMAT_VERSION_STREAM, files, filesBytes };
    }
    if (type !== RECORD_FILE || !ARCHIVE_PATH.test(name) || files.has(name)) throw damaged();
    if (size > limits.maxFileBytes) {
      throw new DomainValidationError(`The export contains a file larger than ${Math.floor(limits.maxFileBytes / MB)} MB`);
    }
    count(size);
    const diskPath = join(dir, `file-${randomBytes(8).toString('hex')}`);
    await pipeline(Readable.from(bytesOf(reader, size)), createWriteStream(diskPath, { flags: 'wx' }));
    files.set(name, { diskPath, size });
    filesBytes += size;
  }
}

/**
 * Decodes an export (format v2, v1 or legacy plain JSON) from a stream. The files of a v2 archive
 * are written into `dir`; nothing in the result may be acted on before this resolves, because
 * only then has every chunk been authenticated and the archive been seen to end where it should.
 */
export async function decodeExportStream(
  input: AsyncIterable<unknown>,
  password: string | undefined,
  dir: string,
  limits: ArchiveLimits,
): Promise<DecodedExport> {
  const reader = new StreamReader(input);
  const start = await reader.read(5);
  const readWhole = async (cap: number) => {
    const parts: Buffer[] = [start];
    let size = start.length;
    for await (const part of reader.rest()) {
      size += part.length;
      if (size > cap) throw new DomainValidationError(MSG_TOO_LARGE);
      parts.push(part);
    }
    return Buffer.concat(parts);
  };

  if (!isEncryptedExport(start) || start[4] !== FORMAT_VERSION_STREAM) {
    // Legacy JSON and format v1 hold one JSON document and no files: read whole, as before
    const bytes = await readWhole(MAX_DECOMPRESSED_BYTES);
    return { data: await decodeExport(bytes, password), formatVersion: isEncryptedExport(bytes) ? bytes[4] : 0, files: new Map(), filesBytes: 0 };
  }

  if (typeof password !== 'string' || password === '') throw new DomainValidationError(MSG_PASSWORD_REQUIRED);
  const headerRest = await reader.read(STREAM_HEADER_LENGTH - start.length);
  const parsed = parseStreamHeader(Buffer.concat([start, headerRest]));
  const { key } = await deriveExportKey(password, parsed.salt, parsed.iterations);

  let decoded: DecodedExport | undefined;
  try {
    await pipeline(
      Readable.from(reader.rest()),
      createDecryptStream(key, parsed),
      createGunzip(),
      async (source: AsyncIterable<unknown>) => {
        decoded = await readContainer(source, dir, limits);
      },
    );
  } catch (error) {
    // gzip that does not inflate inside chunks that authenticated: the file was built wrong
    if (/^Z_/.test(String((error as NodeJS.ErrnoException)?.code))) throw new DomainValidationError(MSG_WRONG_PASSWORD);
    throw error;
  }
  if (!decoded) throw new DomainValidationError(MSG_WRONG_PASSWORD);
  return decoded;
}

/** A fresh private directory under the OS temp folder, for one decode. */
export function createDecodeDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ohd-'));
}

export async function removeDirectory(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
