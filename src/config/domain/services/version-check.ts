import { ProductRelease, findInstalledProduct } from './version-installed-product';

interface GitHubRelease {
  tag_name: string;
  body: string;
  html_url: string;
  published_at: string;
}

interface ReleaseComponents {
  backend: string | null;
  client: string | null;
}

export interface LatestRelease {
  product: string;
  components: ReleaseComponents;
  url: string;
  date: string;
}

export interface VersionCheckResult {
  backend: string;
  /** Product version this installation runs, or null when its components match no release. */
  currentProduct: string | null;
  latestRelease: LatestRelease | null;
  latestComponents: {
    backend: string | null;
    client: string | null;
  };
}

const CACHE_TTL_MS = 60 * 60 * 1000;

const REPOS = {
  umbrella: 'Hyzokaaa/open-helpdesk',
  backend: 'Hyzokaaa/open-helpdesk-backend',
  client: 'Hyzokaaa/open-helpdesk-client',
};

interface FetchedVersions {
  latestRelease: LatestRelease | null;
  latestComponents: { backend: string | null; client: string | null };
  releases: ProductRelease[];
}

export class VersionCheck {
  private cache: { data: FetchedVersions; fetchedAt: number } | null = null;

  constructor(private readonly currentBackend: string) {}

  /** `currentClient` is the version the admin's browser runs, which the server cannot know. */
  async execute(currentClient: string | null = null): Promise<VersionCheckResult> {
    const data = await this.fetchVersions();
    return {
      backend: this.currentBackend,
      currentProduct: findInstalledProduct(data.releases, this.currentBackend, currentClient),
      latestRelease: data.latestRelease,
      latestComponents: data.latestComponents,
    };
  }

  private async fetchVersions(): Promise<FetchedVersions> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const [latestRelease, latestBackend, latestClient, releases] = await Promise.all([
      this.fetchLatestRelease(),
      this.fetchLatestTag(REPOS.backend),
      this.fetchLatestTag(REPOS.client),
      this.fetchReleaseManifest(),
    ]);

    const data: FetchedVersions = {
      latestRelease,
      latestComponents: { backend: latestBackend, client: latestClient },
      releases,
    };
    this.cache = { data, fetchedAt: Date.now() };
    return data;
  }

  /** The product → components mapping published with every release (releases.json). */
  private async fetchReleaseManifest(): Promise<ProductRelease[]> {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPOS.umbrella}/main/releases.json`, {
        headers: { 'User-Agent': 'OpenHelpdesk' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private async fetchLatestRelease(): Promise<LatestRelease | null> {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPOS.umbrella}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OpenHelpdesk' },
      });
      if (!res.ok) return null;
      const data: GitHubRelease = await res.json();
      return {
        product: data.tag_name.replace(/^v/, ''),
        components: this.parseComponents(data.body),
        url: data.html_url,
        date: data.published_at,
      };
    } catch {
      return null;
    }
  }

  private async fetchLatestTag(repo: string): Promise<string | null> {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OpenHelpdesk' },
      });
      if (!res.ok) return null;
      const data: GitHubRelease = await res.json();
      return data.tag_name.replace(/^v/, '');
    } catch {
      return null;
    }
  }

  private parseComponents(body: string): ReleaseComponents {
    const backendMatch = body.match(/backend:\s*v?(\d+\.\d+\.\d+)/i);
    const clientMatch = body.match(/client:\s*v?(\d+\.\d+\.\d+)/i);
    return {
      backend: backendMatch?.[1] ?? null,
      client: clientMatch?.[1] ?? null,
    };
  }
}
