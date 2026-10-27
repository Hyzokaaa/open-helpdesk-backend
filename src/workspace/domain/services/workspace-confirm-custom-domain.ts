import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { isCustomDomainTrusted } from './workspace-custom-domain-trust';

interface ConfirmCustomDomainProps {
  workspaceId: string;
}

export interface CustomDomainConfirmation {
  domain: string;
  /** Whether sessions are handed over to the domain after the check. */
  trusted: boolean;
  /** It was failing and passes now, so the count starts over. */
  recovered: boolean;
  dnsValid: boolean;
  txtValid: boolean;
}

/**
 * "Check now" on a verified custom domain that the daily check finds failing: the same rule as
 * RecheckCustomDomain (its DNS points to the installation, or it still publishes the TXT record it
 * was verified with), run on request so nobody waits for the next day. A pass starts the count
 * over; a failure changes nothing, so pressing it again and again cannot distrust a domain.
 */
export class ConfirmCustomDomain {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly pointsToInstallation: (domain: string) => Promise<boolean>,
    private readonly keepsVerificationRecord: (domain: string, token: string) => Promise<boolean>,
  ) {}

  async execute(props: ConfirmCustomDomainProps): Promise<CustomDomainConfirmation> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    if (!workspace.customDomain || !workspace.customDomainVerified) {
      throw new DomainValidationError('This workspace has no verified custom domain to check');
    }

    const domain = workspace.customDomain;
    const token = workspace.domainVerificationToken;
    const dnsValid = await this.pointsToInstallation(domain);
    // A domain a system administrator added without DNS checks has no record to look for
    const txtValid = !!token && await this.keepsVerificationRecord(domain, token);

    if (!dnsValid && !txtValid) {
      return { domain, trusted: isCustomDomainTrusted(workspace), recovered: false, dnsValid, txtValid };
    }

    const recovered = workspace.customDomainCheckFailures > 0;
    if (recovered) {
      workspace.customDomainCheckFailures = 0;
      workspace.customDomainFailingSince = null;
      await this.repository.update(workspace);
    }
    return { domain, trusted: true, recovered, dnsValid, txtValid };
  }
}
