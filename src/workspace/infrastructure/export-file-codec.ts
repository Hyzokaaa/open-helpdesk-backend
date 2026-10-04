import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from 'node:crypto';
import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { DomainValidationError } from '../../shared/domain/errors';

/**
 * The .ohd workspace export file, format v1:
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
