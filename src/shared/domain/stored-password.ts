import { DomainValidationError } from './errors';

/** What a settings form sends instead of a password to keep the one already saved. */
export const KEEP_STORED_PASSWORD = '__keep__';

/** The server and account a connection test is for, with the password typed, if any. */
export interface ConnectionTestTarget {
  host: string | null | undefined;
  user: string | null | undefined;
  password: string | null | undefined;
}

/** The connection already saved, with its password. */
export interface StoredConnection {
  host: string | null | undefined;
  user: string | null | undefined;
  password: string | null | undefined;
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The password to test a connection with: the one typed, or else the saved one, but only for the
 * same server and account it was saved for. Otherwise anyone allowed to edit the settings could
 * point the test at a server of their own and receive a password they were never shown. Null when
 * a password has to be typed.
 */
export function passwordForConnectionTest(target: ConnectionTestTarget, stored: StoredConnection | null): string | null {
  if (target.password && target.password !== KEEP_STORED_PASSWORD) return target.password;
  if (!stored?.password) return null;
  return same(target.host, stored.host) && same(target.user, stored.user) ? stored.password : null;
}

/**
 * Refuses to keep the saved password for a server or account other than its own: the next email
 * or poll would hand it to that server. Saving with a new password, or the same server and user,
 * goes through.
 */
export function ensureSavedPasswordStaysWithItsServer(next: ConnectionTestTarget, stored: StoredConnection | null): void {
  if (next.password && next.password !== KEEP_STORED_PASSWORD) return;
  if (!stored?.password) return;
  if (same(next.host, stored.host) && same(next.user, stored.user)) return;
  throw new PasswordRequiredError();
}

export class PasswordRequiredError extends DomainValidationError {
  constructor() {
    super(PASSWORD_REQUIRED.error);
  }
}

/** The answer of a test that needs the password typed. */
export const PASSWORD_REQUIRED = {
  success: false as const,
  error: 'Type the password: the saved one is only used with the same server and user',
  errorCode: 'password-required' as const,
};
