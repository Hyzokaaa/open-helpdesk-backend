import { gzipSync } from 'node:zlib';
import {
  decodeExport,
  deriveExportKey,
  encodeExport,
  encodeExportWithKey,
  MAX_DECOMPRESSED_BYTES,
  MSG_NOT_AN_EXPORT,
  MSG_PASSWORD_REQUIRED,
  MSG_WRONG_PASSWORD,
} from '../../../../src/workspace/infrastructure/export-file-codec';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

// Few iterations keep the suite fast; the production default is exercised once below.
const FAST = 1_000;
const PASSWORD = 'correct horse battery';
const DATA = { version: '1.15.0', workspace: { name: 'Acme', description: 'ñandú ✓' }, tickets: [{ id: 't1' }] };

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a rejection');
}

describe('export file codec', () => {
  it('round-trips an object through the encrypted format', async () => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('OHDX');
    expect(bytes[4]).toBe(1);
    expect(bytes.readUInt32BE(5)).toBe(FAST);
    expect(bytes.includes(Buffer.from('Acme'))).toBe(false);
    await expect(decodeExport(bytes, PASSWORD)).resolves.toEqual(DATA);
  });

  it('writes 600000 PBKDF2 iterations by default', async () => {
    const bytes = await encodeExport(DATA, PASSWORD);
    expect(bytes.readUInt32BE(5)).toBe(600_000);
    await expect(decodeExport(bytes, PASSWORD)).resolves.toEqual(DATA);
  });

  it('encrypts with a key derived ahead of time', async () => {
    const context = await deriveExportKey(PASSWORD, undefined, FAST);
    const bytes = await encodeExportWithKey(DATA, context);
    await expect(decodeExport(bytes, PASSWORD)).resolves.toEqual(DATA);
  });

  it('rejects a wrong password', async () => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    const error = await rejection(decodeExport(bytes, 'another password!'));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe(MSG_WRONG_PASSWORD);
  });

  it.each([
    ['ciphertext', (b: Buffer) => b.length - 20],
    ['tag', (b: Buffer) => b.length - 1],
    ['salt', () => 10],
    ['iterations', () => 8],
  ])('rejects a file with a tampered %s byte', async (_part, at) => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    const i = at(bytes);
    bytes[i] ^= 0x01;
    const error = await rejection(decodeExport(bytes, PASSWORD));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe(MSG_WRONG_PASSWORD);
  });

  it('asks for the password when an encrypted file comes without one', async () => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    for (const missing of [undefined, '']) {
      const error = await rejection(decodeExport(bytes, missing));
      expect(error).toBeInstanceOf(DomainValidationError);
      expect(error.message).toBe(MSG_PASSWORD_REQUIRED);
    }
  });

  it('refuses an iteration count above the cap without deriving a key', async () => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    bytes.writeUInt32BE(0xffffffff, 5);
    const started = Date.now();
    const error = await rejection(decodeExport(bytes, PASSWORD));
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe(MSG_WRONG_PASSWORD);
  });

  it('refuses an unknown format version', async () => {
    const bytes = await encodeExport(DATA, PASSWORD, FAST);
    bytes[4] = 2;
    const error = await rejection(decodeExport(bytes, PASSWORD));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toMatch(/file format 2/);
  });

  it('reads a legacy plain JSON export, with or without a password', async () => {
    const bytes = Buffer.from('﻿' + JSON.stringify(DATA, null, 2), 'utf8');
    await expect(decodeExport(bytes)).resolves.toEqual(DATA);
    await expect(decodeExport(bytes, 'ignored')).resolves.toEqual(DATA);
  });

  it.each([
    ['binary garbage', Buffer.from([0x00, 0xff, 0x13, 0x37])],
    ['text that is not JSON', Buffer.from('hello world')],
    ['a JSON array', Buffer.from('[1,2,3]')],
    ['a truncated encrypted header', Buffer.from('OHDX')],
  ])('rejects %s', async (_name, bytes) => {
    const error = await rejection(decodeExport(bytes, PASSWORD));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect([MSG_NOT_AN_EXPORT, MSG_WRONG_PASSWORD]).toContain(error.message);
  });

  it('stops a payload that decompresses beyond the cap', async () => {
    const context = await deriveExportKey(PASSWORD, undefined, FAST);
    // A valid encrypted file whose gzip expands past the limit: encrypt a hand-made gzip stream.
    const bomb = gzipSync(Buffer.alloc(MAX_DECOMPRESSED_BYTES + 1024, 0x20));
    const { createCipheriv, randomBytes } = await import('node:crypto');
    const reference = await encodeExportWithKey({}, context);
    const header = Buffer.from(reference.subarray(0, 37));
    const iv = randomBytes(12);
    iv.copy(header, 25);
    const cipher = createCipheriv('aes-256-gcm', context.key, iv);
    cipher.setAAD(header);
    const body = Buffer.concat([cipher.update(bomb), cipher.final()]);
    const bytes = Buffer.concat([header, body, cipher.getAuthTag()]);

    const error = await rejection(decodeExport(bytes, PASSWORD));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe('The export is too large');
  });

  it('enforces the export password length', async () => {
    await expect(encodeExport(DATA, 'short', FAST)).rejects.toThrow(/at least 12/);
    await expect(encodeExport(DATA, 'x'.repeat(257), FAST)).rejects.toThrow(/at most 256/);
  });
});
