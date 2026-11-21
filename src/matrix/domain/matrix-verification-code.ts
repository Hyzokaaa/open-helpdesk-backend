import { createHash, randomInt, timingSafeEqual } from 'crypto';

/** How long a code works. */
export const MATRIX_CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong codes allowed before a new one has to be asked for. */
export const MATRIX_CODE_MAX_ATTEMPTS = 5;
/** The wait between two codes, so the bot cannot be used to flood someone with invitations. */
export const MATRIX_CODE_COOLDOWN_MS = 60 * 1000;
/** Codes a user may ask for in a day. */
export const MATRIX_CODES_PER_DAY = 10;
export const MATRIX_CODE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Six random digits. */
export function newMatrixCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** What is stored instead of the code: tied to the identity, so one hash is no use for another. */
export function hashMatrixCode(identityId: string, code: string): string {
  return createHash('sha256').update(`${identityId}:${code}`).digest('hex');
}

export function matrixCodeMatches(identityId: string, code: string, storedHash: string): boolean {
  const given = Buffer.from(hashMatrixCode(identityId, code.trim()), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}
