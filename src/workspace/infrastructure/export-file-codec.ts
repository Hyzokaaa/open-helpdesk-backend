import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from 'node:crypto';
import { Transform, TransformCallback } from 'node:stream';
import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { DomainValidationError } from '../../shared/domain/errors';

/**
 * The .ohd workspace export file. Exports are written in format v2; v1 and the plain JSON of
 * older versions are still read.
 *
 * Format v2, written and read as a stream (export-archive.ts defines what the plaintext holds):
 *
 *   header = "OHDX" (4) | format version = 2 (1) | PBKDF2 iterations uint32 BE (4) | salt (16)
 *            | nonce prefix (8, random per file) | chunk size uint32 BE (4)
 *   then the gzip stream cut into chunks of `chunk size` bytes (the last one may be shorter, or
 *   empty), each stored as AES-256-GCM ciphertext || tag (16), with
 *     nonce = nonce prefix || chunk counter uint32 BE (from 0)
 *     AAD   = header || chunk counter uint32 BE || final flag (1 byte: 1 on the last chunk only)
 *
 * Every chunk is authenticated before its plaintext is used. The counter in nonce and AAD rejects
 * reordered, duplicated or dropped chunks; the final flag rejects a file cut at a chunk boundary.
 * The key is PBKDF2-SHA256(password, salt, iterations, 32), as in v1.
 *
 * Format v1:
 *
 *   "OHDX" (4) | format version = 1 (1) | PBKDF2 iterations uint32 BE (4) | salt (16) | iv (12)
 *   | AES-256-GCM ciphertext of gzip(JSON.stringify(data)) | GCM tag (16)
 *
 * The key is PBKDF2-SHA256(password, salt, iterations, 32). The 37-byte header is bound to the
 * ciphertext as GCM additional data, so changing the iterations or the version breaks the tag.
 * Files that do not start with the magic are read as the plain JSON exports of older versions.
 */

const pbkdf2Async = promisify(pbkdf2);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const MAGIC = Buffer.from('OHDX', 'ascii');
const FORMAT_VERSION = 1;
export const FORMAT_VERSION_STREAM = 2;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + 4 + SALT_LENGTH + IV_LENGTH;
const KEY_LENGTH = 32;

export const EXPORT_PBKDF2_ITERATIONS = 600_000;
/** Upper bound accepted on decode, so a crafted header cannot pin the CPU for minutes. */
export const MAX_PBKDF2_ITERATIONS = 5_000_000;
/** Upper bound on the decompressed JSON, so a small file cannot expand into gigabytes. */
export const MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024;

const NONCE_PREFIX_LENGTH = 8;
export const STREAM_HEADER_LENGTH = MAGIC.length + 1 + 4 + SALT_LENGTH + NONCE_PREFIX_LENGTH + 4;
export const DEFAULT_CHUNK_SIZE = 1024 * 1024;
/** Upper bound on the chunk size accepted on decode, since a whole chunk is held to verify it. */
export const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

export const EXPORT_PASSWORD_MIN_LENGTH = 12;
export const EXPORT_PASSWORD_MAX_LENGTH = 256;

export const MSG_PASSWORD_REQUIRED = 'This export is encrypted: enter its password';
export const MSG_WRONG_PASSWORD = 'Wrong password, or the file was modified or damaged';
export const MSG_NOT_AN_EXPORT = 'Not an Open Helpdesk export file';
export const MSG_TOO_LARGE = 'The export is too large';

/** A key derived ahead of time, so an export can be encrypted later without keeping the password. */
export interface ExportKeyContext {
  key: Buffer;
  salt: Buffer;
  iterations: number;
}

export function assertExportPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < EXPORT_PASSWORD_MIN_LENGTH) {
    throw new DomainValidationError(`The export password must be at least ${EXPORT_PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > EXPORT_PASSWORD_MAX_LENGTH) {
    throw new DomainValidationError(`The export password must be at most ${EXPORT_PASSWORD_MAX_LENGTH} characters`);
  }
}

export async function deriveExportKey(
  password: string,
  salt: Buffer = randomBytes(SALT_LENGTH),
  iterations: number = EXPORT_PBKDF2_ITERATIONS,
): Promise<ExportKeyContext> {
  const key = await pbkdf2Async(password, salt, iterations, KEY_LENGTH, 'sha256');
  return { key, salt, iterations };
}

export async function encodeExportWithKey(data: object, context: ExportKeyContext): Promise<Buffer> {
  const plaintext = await gzipAsync(Buffer.from(JSON.stringify(data), 'utf8'));
  const iv = randomBytes(IV_LENGTH);
  const header = Buffer.alloc(HEADER_LENGTH);
  let offset = MAGIC.copy(header, 0);
  header.writeUInt8(FORMAT_VERSION, offset);
  offset += 1;
  header.writeUInt32BE(context.iterations, offset);
  offset += 4;
  offset += context.salt.copy(header, offset);
  iv.copy(header, offset);

  const cipher = createCipheriv('aes-256-gcm', context.key, iv);
  cipher.setAAD(header);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([header, ciphertext, cipher.getAuthTag()]);
}

export async function encodeExport(
  data: object,
  password: string,
  iterations: number = EXPORT_PBKDF2_ITERATIONS,
): Promise<Buffer> {
  assertExportPassword(password);
  return encodeExportWithKey(data, await deriveExportKey(password, undefined, iterations));
}

export interface StreamHeader {
  header: Buffer;
  iterations: number;
  salt: Buffer;
  noncePrefix: Buffer;
  chunkSize: number;
}

/** Reads a v2 header; throws DomainValidationError when it is not one this server reads. */
export function parseStreamHeader(header: Buffer): StreamHeader {
  if (header.length !== STREAM_HEADER_LENGTH || !isEncryptedExport(header)) throw new DomainValidationError(MSG_WRONG_PASSWORD);
  if (header.readUInt8(MAGIC.length) !== FORMAT_VERSION_STREAM) throw new DomainValidationError(MSG_WRONG_PASSWORD);
  let offset = MAGIC.length + 1;
  const iterations = header.readUInt32BE(offset);
  offset += 4;
  const salt = header.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const noncePrefix = header.subarray(offset, offset + NONCE_PREFIX_LENGTH);
  offset += NONCE_PREFIX_LENGTH;
  const chunkSize = header.readUInt32BE(offset);
  if (iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) throw new DomainValidationError(MSG_WRONG_PASSWORD);
  if (chunkSize < 1 || chunkSize > MAX_CHUNK_SIZE) throw new DomainValidationError(MSG_WRONG_PASSWORD);
  return { header: Buffer.from(header), iterations, salt, noncePrefix, chunkSize };
}

function chunkNonceAndAad(header: Buffer, noncePrefix: Buffer, counter: number, final: boolean) {
  const counterBytes = Buffer.alloc(4);
  counterBytes.writeUInt32BE(counter, 0);
  return {
    nonce: Buffer.concat([noncePrefix, counterBytes]),
    aad: Buffer.concat([header, counterBytes, Buffer.from([final ? 1 : 0])]),
  };
}

/** Holds incoming bytes and hands them out in fixed-size pieces. */
class ByteQueue {
  private parts: Buffer[] = [];
  length = 0;

  push(chunk: Buffer) {
    this.parts.push(chunk);
    this.length += chunk.length;
  }

  take(size: number): Buffer {
    const taken: Buffer[] = [];
    let needed = Math.min(size, this.length);
    this.length -= needed;
    while (needed > 0) {
      const first = this.parts[0];
      if (first.length <= needed) {
        taken.push(first);
        this.parts.shift();
        needed -= first.length;
      } else {
        taken.push(first.subarray(0, needed));
        this.parts[0] = first.subarray(needed);
        needed = 0;
      }
    }
    return taken.length === 1 ? taken[0] : Buffer.concat(taken);
  }
}

/**
 * Encrypts a byte stream (the gzip output) into format v2, header first. A full chunk is sealed
 * only once more bytes follow it, so the last chunk, and only it, carries the final flag.
 */
export function createEncryptStream(context: ExportKeyContext, options: { chunkSize?: number } = {}): Transform {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > MAX_CHUNK_SIZE) throw new Error('Invalid chunk size');

  const header = Buffer.alloc(STREAM_HEADER_LENGTH);
  let offset = MAGIC.copy(header, 0);
  header.writeUInt8(FORMAT_VERSION_STREAM, offset);
  offset += 1;
  header.writeUInt32BE(context.iterations, offset);
  offset += 4;
  offset += context.salt.copy(header, offset);
  const noncePrefix = randomBytes(NONCE_PREFIX_LENGTH);
  offset += noncePrefix.copy(header, offset);
  header.writeUInt32BE(chunkSize, offset);

  const queue = new ByteQueue();
  let counter = 0;
  let headerSent = false;
  const seal = (plaintext: Buffer, final: boolean): Buffer => {
    if (counter > 0xffffffff) throw new Error('Export too large for the chunk counter');
    const { nonce, aad } = chunkNonceAndAad(header, noncePrefix, counter++, final);
    const cipher = createCipheriv('aes-256-gcm', context.key, nonce);
    cipher.setAAD(aad);
    return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  };

  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        if (!headerSent) this.push(header);
        headerSent = true;
        queue.push(chunk);
        while (queue.length > chunkSize) this.push(seal(queue.take(chunkSize), false));
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback) {
      try {
        if (!headerSent) this.push(header);
        headerSent = true;
        callback(null, seal(queue.take(queue.length), true));
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

/**
 * Decrypts the chunks that follow a v2 header. Each chunk is verified before its plaintext is
 * passed on; a tag failure, a missing final chunk or a reordered chunk fails the stream with
 * MSG_WRONG_PASSWORD. Which chunk is last is only known when the input ends, so a full chunk is
 * held until more bytes follow it.
 */
export function createDecryptStream(key: Buffer, parsed: StreamHeader): Transform {
  const sealedChunkSize = parsed.chunkSize + TAG_LENGTH;
  const queue = new ByteQueue();
  let counter = 0;
  const open = (sealed: Buffer, final: boolean): Buffer => {
    if (sealed.length < TAG_LENGTH || counter > 0xffffffff) throw new DomainValidationError(MSG_WRONG_PASSWORD);
    const { nonce, aad } = chunkNonceAndAad(parsed.header, parsed.noncePrefix, counter++, final);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(aad);
      decipher.setAuthTag(sealed.subarray(sealed.length - TAG_LENGTH));
      return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - TAG_LENGTH)), decipher.final()]);
    } catch {
      throw new DomainValidationError(MSG_WRONG_PASSWORD);
    }
  };

  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        queue.push(chunk);
        while (queue.length > sealedChunkSize) this.push(open(queue.take(sealedChunkSize), false));
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback) {
      try {
        callback(null, open(queue.take(queue.length), true));
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

export function isEncryptedExport(bytes: Buffer): boolean {
  return bytes.length >= MAGIC.length && bytes.subarray(0, MAGIC.length).equals(MAGIC);
}

export async function decodeExport(bytes: Buffer, password?: string): Promise<object> {
  if (!isEncryptedExport(bytes)) return parseLegacyJson(bytes);

  if (typeof password !== 'string' || password === '') throw new DomainValidationError(MSG_PASSWORD_REQUIRED);
  if (bytes.length < HEADER_LENGTH + TAG_LENGTH) throw new DomainValidationError(MSG_WRONG_PASSWORD);

  const version = bytes.readUInt8(MAGIC.length);
  if (version !== FORMAT_VERSION) {
    throw new DomainValidationError(
      `This export uses file format ${version}, which this server cannot read. Upgrade Open Helpdesk first.`,
    );
  }
  const iterations = bytes.readUInt32BE(MAGIC.length + 1);
  if (iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) throw new DomainValidationError(MSG_WRONG_PASSWORD);

  const header = bytes.subarray(0, HEADER_LENGTH);
  const salt = bytes.subarray(MAGIC.length + 5, MAGIC.length + 5 + SALT_LENGTH);
  const iv = bytes.subarray(MAGIC.length + 5 + SALT_LENGTH, HEADER_LENGTH);
  const ciphertext = bytes.subarray(HEADER_LENGTH, bytes.length - TAG_LENGTH);
  const tag = bytes.subarray(bytes.length - TAG_LENGTH);

  const { key } = await deriveExportKey(password, salt, iterations);
  let compressed: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new DomainValidationError(MSG_WRONG_PASSWORD);
  }

  let json: Buffer;
  try {
    json = await gunzipAsync(compressed, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ERR_BUFFER_TOO_LARGE' || error instanceof RangeError) {
      throw new DomainValidationError(MSG_TOO_LARGE);
    }
    throw new DomainValidationError(MSG_WRONG_PASSWORD);
  }
  const parsed = parseJsonObject(json);
  if (!parsed) throw new DomainValidationError(MSG_NOT_AN_EXPORT);
  return parsed;
}

function parseLegacyJson(bytes: Buffer): object {
  if (bytes.length > MAX_DECOMPRESSED_BYTES) throw new DomainValidationError(MSG_TOO_LARGE);
  const parsed = parseJsonObject(bytes);
  if (!parsed) throw new DomainValidationError(MSG_NOT_AN_EXPORT);
  return parsed;
}

function parseJsonObject(bytes: Buffer): object | null {
  let text = bytes.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
