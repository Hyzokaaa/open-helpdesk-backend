import { DomainValidationError } from '../../../shared/domain/errors';

const SITE_ID_REGEX = /^[1-9][0-9]{0,9}$/;

/**
 * The Matomo server URL as stored: https only, no credentials, query or fragment, reduced to
 * origin and path with a trailing slash. Throws DomainValidationError otherwise.
 */
export function normalizeMatomoServerUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') throw new DomainValidationError('Server URL is required for Matomo');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DomainValidationError('Server URL is not a valid URL');
  }

  if (url.protocol !== 'https:') throw new DomainValidationError('Server URL must use https');
  if (url.username || url.password) throw new DomainValidationError('Server URL must not contain credentials');
  if (url.search) throw new DomainValidationError('Server URL must not contain a query string');
  if (url.hash) throw new DomainValidationError('Server URL must not contain a fragment');

  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return `${url.origin}${path}`;
}

/** The Matomo site ID as stored: a positive integer of at most 10 digits. Throws DomainValidationError otherwise. */
export function normalizeMatomoSiteId(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') throw new DomainValidationError('Site ID is required for Matomo');
  if (!SITE_ID_REGEX.test(trimmed)) {
    throw new DomainValidationError('Site ID must be a positive integer of at most 10 digits');
  }
  return trimmed;
}
