import { compareVersions } from './version-installed-product';

interface ReleaseWithBackend {
  components: { backend?: string | null };
}

/**
 * Whether the latest release is worth telling the admins about: it ships a newer backend than the
 * one running. The product number cannot be compared with the backend's (each has its own), and the
 * server does not know which client the browsers run, so a release that only changes the client is
 * left to the Updates page, which does know it.
 */
export function bringsNewerBackend(latest: ReleaseWithBackend | null, installedBackend: string): boolean {
  const backend = latest?.components.backend?.replace(/^v/, '');
  if (!backend || !/^\d+\.\d+\.\d+$/.test(installedBackend)) return false;
  return compareVersions(backend, installedBackend) > 0;
}
