import { DomainValidationError } from '../../shared/domain/errors';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt only reads the first 72 bytes; the cap also bounds hashing cost per request. */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_MESSAGE =
  `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters and not only spaces`;

/**
 * The rule every NEW password must meet: 8 to 128 characters, not only whitespace.
 * Deliberately modest (no composition rules). Existing passwords are never re-checked,
 * so accounts created under the old 6-character minimum keep signing in.
 */
export function isPasswordAcceptable(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    password.trim().length > 0
  );
}

export function ensurePasswordAcceptable(password: unknown): void {
  if (!isPasswordAcceptable(password)) {
    throw new DomainValidationError(PASSWORD_POLICY_MESSAGE);
  }
}
