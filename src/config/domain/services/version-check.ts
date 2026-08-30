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

export class VersionCheck {
  private cache: { result: VersionCheckResult; fetchedAt: number } | null = null;

  constructor(private readonly currentBackend: string) {}

  async execute(): Promise<VersionCheckResult> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.result;
    }

    const [latestRelease, latestBackend, latestClient] = await Promise.all([
      this.fetchLatestRelease(),
      this.fetchLatestTag(REPOS.backend),
      this.fetchLatestTag(REPOS.client),
    ]);

    const result: VersionCheckResult = {
      backend: this.currentBackend,
      latestRelease,
      latestComponents: {
        backend: latestBackend,
        client: latestClient,
      },
    };

    this.cache = { result, fetchedAt: Date.now() };
    return result;
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
