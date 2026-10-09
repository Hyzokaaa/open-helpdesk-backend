/**
 * What went wrong when connecting to a mail server, for the client to explain in the user's language.
 * The values are part of the connection test responses: add new ones, do not rename them.
 */
export type ConnectionErrorKind =
  | 'auth-failed'
  | 'tls-mismatch'
  | 'tls-required'
  | 'wrong-port'
  | 'host-not-found'
  | 'refused'
  | 'timeout'
  | 'certificate'
  | 'unknown';

interface ConnectionError {
  message?: unknown;
  code?: unknown;
  responseCode?: unknown;
  authenticationFailed?: unknown;
  errors?: unknown;
}

const CERTIFICATE_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/**
 * Classified from flags and codes before wording, since each server phrases a refused login its own
 * way (Carbonio "AUTHENTICATE failed", Gmail "Invalid credentials", Postfix "535 ... authentication failed").
 */
export function connectionErrorKind(err: unknown): ConnectionErrorKind {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as ConnectionError;
  const codes = [e.code, ...(Array.isArray(e.errors) ? e.errors.map((i) => (i as ConnectionError)?.code) : [])]
    .filter((c): c is string => typeof c === 'string');
  const message = typeof e.message === 'string' ? e.message : '';

  if (e.authenticationFailed === true || codes.includes('EAUTH') || e.responseCode === 535) return 'auth-failed';
  if (codes.some((c) => CERTIFICATE_CODES.has(c)) || /certificate/i.test(message)) return 'certificate';
  if (codes.includes('ERR_SSL_WRONG_VERSION_NUMBER') || /wrong version number/i.test(message)) return 'tls-mismatch';
  if (/should use TLS/i.test(message)) return 'tls-required';
  if (/greeting/i.test(message)) return 'wrong-port';
  // nodemailer files network errors under its own codes (ESOCKET, EDNS) and keeps Node's in the message
  if (codes.includes('ENOTFOUND') || codes.includes('EAI_AGAIN') || /ENOTFOUND|EAI_AGAIN/.test(message)) return 'host-not-found';
  if (codes.includes('ECONNREFUSED') || /ECONNREFUSED/.test(message)) return 'refused';
  if (codes.includes('ETIMEDOUT') || codes.includes('ETIMEOUT') || /timeout|timed out/i.test(message)) return 'timeout';
  return 'unknown';
}
