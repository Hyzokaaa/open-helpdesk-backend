export interface ProductRelease {
  product: string;
  components: { backend?: string | null; client?: string | null };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/**
 * The product version an installation runs, deduced from its component versions: products are
 * only defined in the release manifest, as a mapping to components. When several releases ship
 * the same components (e.g. a re-release), the newest wins; null when none matches, as with a
 * build from a branch or components from different releases.
 */
export function findInstalledProduct(
  releases: ProductRelease[],
  backend: string,
  client: string | null,
  latest: ProductRelease | null = null,
): string | null {
  if (!client) return null;
  // The manifest is served through a CDN that can lag a fresh release by minutes, while the latest
  // release comes straight from the GitHub API; counting it too keeps the two from disagreeing
  const candidates = latest ? [...releases, latest] : releases;
  const matches = candidates
    .filter((r) => r.components.backend === backend && r.components.client === client)
    .map((r) => r.product);
  if (matches.length === 0) return null;
  return matches.sort(compareVersions)[matches.length - 1];
}

/** The client version the browser reports, kept only when it is a plain X.Y.Z version. */
export function parseClientVersion(value: string | undefined | null): string | null {
  const version = value?.trim();
  return version && /^\d+\.\d+\.\d+$/.test(version) ? version : null;
}
