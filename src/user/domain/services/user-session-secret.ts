import { createHash, randomBytes } from 'crypto';

/**
 * Refresh tokens are random secrets handed to the client once; only their SHA-256 is stored,
 * the same way API keys are.
 */
export class SessionSecret {
  static generate(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: SessionSecret.hash(raw) };
  }

  static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
