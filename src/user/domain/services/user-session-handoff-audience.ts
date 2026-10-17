import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { isCustomDomainTrusted } from '../../../workspace/domain/services/workspace-custom-domain-trust';

/** Where a session may be handed over to: the installation's own address, or a trusted custom domain. */
export type HandoffAudience =
  | { kind: 'installation' }
  | { kind: 'custom-domain'; workspaceIds: string[] };

/**
 * Decides whether an origin (`https://help.example.com`) belongs to this installation. Only those
 * may receive a session, so a crafted link cannot send one anywhere else. Custom domains must be
 * verified, still pass the daily check, and use https without a port, like the installation does;
 * an installation served over plain http (local development) accepts plain http and ports too.
 */
export class ResolveHandoffAudience {
  private readonly installation: URL | null;

  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    installationUrl: string,
  ) {
    this.installation = parseUrl(installationUrl);
  }

  async execute(origin: string): Promise<HandoffAudience | null> {
    const url = parseUrl(origin);
    if (!url || !this.installation || url.origin !== origin) return null;
    if (url.origin === this.installation.origin) return { kind: 'installation' };

    const secure = this.installation.protocol === 'https:';
    if (secure && (url.protocol !== 'https:' || url.port)) return null;

    const workspaces = (await this.workspaceRepository.findByCustomDomain(url.hostname)).filter(isCustomDomainTrusted);
    if (workspaces.length === 0) return null;
    return { kind: 'custom-domain', workspaceIds: workspaces.map((w) => w.getId()) };
  }
}

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}
