import { QueryFailedError } from 'typeorm';

/** Whether a write failed because another row already holds a unique value (Postgres 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
}
