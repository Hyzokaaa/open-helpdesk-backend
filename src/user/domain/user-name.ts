import { sanitizePlainText } from '../../shared/domain/sanitize-plain-text';

/** Longest first or last name stored; the request DTOs enforce the same limit. */
export const USER_NAME_MAX_LENGTH = 100;

/**
 * Names are rendered as-is by the client (mentions, headers, emails), so they are reduced to
 * plain text on the way in: no tags or angle brackets, no control or invisible characters.
 */
export function normalizeUserName(value: string): string {
  return sanitizePlainText(value, USER_NAME_MAX_LENGTH);
}
