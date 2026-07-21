import { randomBytes } from 'crypto';

interface TokenEntry {
  workspaceId: string;
  expiresAt: number;
}

const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours
const tokens = new Map<string, TokenEntry>();

export function createExportToken(workspaceId: string): { token: string; expiresAt: Date } {
  // Cleanup expired tokens
  const now = Date.now();
  for (const [key, entry] of tokens) {
    if (entry.expiresAt < now) tokens.delete(key);
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = now + TOKEN_TTL;
  tokens.set(token, { workspaceId, expiresAt });
  return { token, expiresAt: new Date(expiresAt) };
}

export function validateExportToken(token: string): string | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  // Single use — delete after validation
  tokens.delete(token);
  return entry.workspaceId;
}
