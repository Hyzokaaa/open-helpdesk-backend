/**
 * Encrypts the secrets kept for other services (a chat bot's access token), so a copy of the
 * database alone does not reveal them: the key lives in the environment, never in the database.
 */
export interface SecretCipher {
  encrypt(plain: string): string;
  /** Null when the value cannot be read: the key changed since it was saved, or it is not ours. */
  decrypt(stored: string): string | null;
}
