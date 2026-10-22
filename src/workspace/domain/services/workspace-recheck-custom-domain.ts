import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { CUSTOM_DOMAIN_FAILURES_BEFORE_DISTRUST } from './workspace-custom-domain-trust';

export type CustomDomainCheckOutcome =
  /** Points to the installation, as before. */
  | 'ok'
  /** Points here again after failing: trusted again. */
  | 'recovered'
  /** Failed for the first time in a row: the admins are told. */
  | 'started-failing'
  /** Failed again, not yet enough to distrust it. */
  | 'still-failing'
  /** Failed enough days in a row: sessions are no longer handed over to it. */
  | 'distrusted'
  /** Already distrusted and still failing. */
  | 'still-distrusted';

/**
 * The daily check of a verified custom domain: is it still ours? A domain can change hands or be
 * pointed elsewhere after it was verified, so several failures in a row stop sessions being handed
 * over to it. It passes when its DNS points to the installation, or when it still publishes the TXT
 * record it was verified with: a new owner starts from an empty zone, and a domain behind a proxy
 * (Cloudflare) points to the server, not to the proxy's addresses the installation's own name has.
 * The domain stays verified, so a passing check restores it without anyone doing anything.
 */
export class RecheckCustomDomain {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly pointsToInstallation: (domain: string) => Promise<boolean>,
    private readonly keepsVerificationRecord: (domain: string, token: string) => Promise<boolean>,
  ) {}

  async execute(workspace: Workspace, now: Date = new Date()): Promise<CustomDomainCheckOutcome> {
    if (!workspace.customDomain || !workspace.customDomainVerified) return 'ok';

    if (await this.stillOurs(workspace.customDomain, workspace.domainVerificationToken)) {
      if (workspace.customDomainCheckFailures === 0) return 'ok';
      workspace.customDomainCheckFailures = 0;
      workspace.customDomainFailingSince = null;
      await this.repository.update(workspace);
      return 'recovered';
    }

    const failures = workspace.customDomainCheckFailures + 1;
    workspace.customDomainCheckFailures = failures;
    workspace.customDomainFailingSince ??= now;
    await this.repository.update(workspace);

    if (failures === 1) return 'started-failing';
    if (failures < CUSTOM_DOMAIN_FAILURES_BEFORE_DISTRUST) return 'still-failing';
    return failures === CUSTOM_DOMAIN_FAILURES_BEFORE_DISTRUST ? 'distrusted' : 'still-distrusted';
  }

  private async stillOurs(domain: string, token: string | null): Promise<boolean> {
    if (await this.pointsToInstallation(domain)) return true;
    // A domain a system administrator added without DNS checks has no record to look for
    return !!token && this.keepsVerificationRecord(domain, token);
  }
}
