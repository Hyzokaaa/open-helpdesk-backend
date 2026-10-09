interface ConnectionError {
  message?: unknown;
  code?: unknown;
  responseText?: unknown;
  errors?: unknown;
  name?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * The technical reason a mail server connection failed, never empty.
 *
 * Node reports a host with several addresses that all time out as an AggregateError with an empty
 * message, and imapflow says only "Command failed" while the server's words travel in `responseText`.
 */
export function connectionErrorDetail(err: unknown): string {
  if (!err || typeof err !== 'object') return text(err) || 'Unknown error';
  const e = err as ConnectionError;

  const message = text(e.message);
  const serverSaid = text(e.responseText);
  const code = text(e.code);

  if (serverSaid && serverSaid !== message) {
    return message ? `${message}: ${serverSaid}` : serverSaid;
  }
  if (message) return message;

  const inner = Array.isArray(e.errors)
    ? e.errors.map((i) => text((i as ConnectionError)?.message)).find(Boolean)
    : '';
  if (inner) return code && !inner.includes(code) ? `${code}: ${inner}` : inner;
  if (code) return code;

  return text(e.name) || 'Unknown error';
}
