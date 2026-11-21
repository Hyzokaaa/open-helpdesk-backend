import { isIP } from 'net';
import { DomainValidationError } from '../../shared/domain/errors';
import { isPrivateAddress } from '../../shared/infrastructure/private-network';

/**
 * Refuses a homeserver reached without https: the bot's password and token, and every notice,
 * would cross the network readable. Plain http is kept only for a server on this machine or on a
 * private network written as its address (http://localhost:8008, http://192.168.1.10:8008), where
 * there is no one in between; a name could point anywhere, so a name needs https.
 */
export function ensureSecureHomeserver(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainValidationError('The server address has to start with https://');
  }
  if (parsed.protocol === 'https:') return;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const local = host.toLowerCase() === 'localhost' || (isIP(host) !== 0 && isPrivateAddress(host));
  if (parsed.protocol === 'http:' && local) return;
  throw new DomainValidationError('The Matrix server has to be reached with https://, so the bot\'s password and the notices do not travel unencrypted', 'matrix-https-required');
}
