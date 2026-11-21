import { DomainValidationError } from '../../shared/domain/errors';

/** The spec caps a whole user ID at 255 bytes. */
const MAX_LENGTH = 255;
/** @localpart:server, where the localpart is a-z 0-9 . _ = - / + and the server a host with an optional port. */
const USER_ID = /^@[a-z0-9._=\-/+]+:[a-z0-9.-]+(:\d{1,5})?$|^@[a-z0-9._=\-/+]+:\[[0-9a-f:.]+\](:\d{1,5})?$/i;

/** The Matrix ID a user typed, trimmed (older IDs may have capitals, so case is kept), or an error that says what is wrong. */
export function parseMatrixUserId(value: string): string {
  const id = value.trim();
  if (!id) throw new DomainValidationError('Type your Matrix ID', 'matrix-invalid-id');
  if (Buffer.byteLength(id) > MAX_LENGTH || !USER_ID.test(id)) {
    throw new DomainValidationError('That is not a Matrix ID: it looks like @name:example.org', 'matrix-invalid-id');
  }
  return id;
}
