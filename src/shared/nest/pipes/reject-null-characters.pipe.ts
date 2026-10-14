import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Where the first null character is, as a field path (`customFields.region`), or null when there is none. */
export function findNullCharacter(value: unknown, path = ''): string | null {
  if (typeof value === 'string') return value.includes('\u0000') ? path || 'value' : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findNullCharacter(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    for (const [key, item] of Object.entries(value)) {
      const found = findNullCharacter(item, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Rejects request bodies, queries and route params that carry a null character.
 *
 * Postgres cannot store it in text, so it would otherwise fail deep in a save as an
 * internal error. Rejecting it up front gives the caller a clear 400 instead.
 */
@Injectable()
export class RejectNullCharactersPipe implements PipeTransform {
  transform(value: unknown) {
    const field = findNullCharacter(value);
    if (field) throw new BadRequestException(`${field} must not contain null characters`);
    return value;
  }
}
