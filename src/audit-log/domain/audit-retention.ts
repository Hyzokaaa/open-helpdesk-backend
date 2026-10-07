import { DomainValidationError } from '../../shared/domain/errors';
import { AuditCategory } from './enums/audit-category.enum';

/**
 * How many days the entries of each audit category are kept; null keeps them forever. Retention
 * is by age and category, never by count: a cap on the number of entries would let anyone who can
 * generate entries (failed sign-ins, say) push the evidence out.
 */
export type RetentionDays = Record<string, number | null>;

export const RETENTION_CATEGORIES: string[] = Object.values(AuditCategory);

export const MIN_RETENTION_DAYS = 7;
export const MAX_RETENTION_DAYS = 3650;

/** Mail is high volume and low value after a month; access events are kept for a quarter. */
export const DEFAULT_RETENTION_DAYS: RetentionDays = Object.fromEntries(
  RETENTION_CATEGORIES.map((category) => [
    category,
    category === AuditCategory.EMAIL ? 30 : category === AuditCategory.SECURITY ? 90 : 365,
  ]),
);

function validDays(category: string, value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_RETENTION_DAYS || value > MAX_RETENTION_DAYS) {
    throw new DomainValidationError(
      `Retention for ${category} must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days, or kept forever`,
    );
  }
  return value;
}

/** The installation's retention: every category, missing ones at their default. */
export function normalizeInstallationRetention(input: unknown, current: RetentionDays = DEFAULT_RETENTION_DAYS): RetentionDays {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const result: RetentionDays = {};
  for (const category of RETENTION_CATEGORIES) {
    result[category] = category in source ? validDays(category, source[category]) : (current[category] ?? DEFAULT_RETENTION_DAYS[category]);
  }
  return result;
}

/**
 * A workspace's own retention: only categories it keeps longer than the installation. A
 * workspace may never shorten it, or an admin could erase the record of what they did.
 */
export function normalizeWorkspaceRetention(input: unknown, installation: RetentionDays): RetentionDays {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const result: RetentionDays = {};
  for (const category of RETENTION_CATEGORIES) {
    if (!(category in source)) continue;
    const days = validDays(category, source[category]);
    const floor = installation[category];
    if (floor === null) continue; // the installation already keeps it forever
    if (days !== null && days < floor) {
      throw new DomainValidationError(`A workspace can only keep ${category} entries longer than the installation (${floor} days)`);
    }
    if (days === floor) continue; // no different from the installation
    result[category] = days;
  }
  return result;
}

/** What applies to a workspace: the longer of the installation's and its own, per category. */
export function effectiveRetention(installation: RetentionDays, workspace: RetentionDays): RetentionDays {
  const result: RetentionDays = {};
  for (const category of RETENTION_CATEGORIES) {
    const base = installation[category] ?? null;
    if (!(category in workspace)) {
      result[category] = base;
      continue;
    }
    const own = workspace[category];
    result[category] = base === null || own === null ? null : Math.max(base, own);
  }
  return result;
}
