import { promises as dns } from 'dns';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface VerifyCustomDomainProps {
  workspaceId: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  dnsValid: boolean;
  txtValid: boolean;
  cnameTarget: string;
  txtRecord: string;
}

/** DNS names compare case-insensitively and may carry the root's trailing dot. */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/.$/, '');
}

export class VerifyCustomDomain {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly expectedCnameTarget: string,
  ) {}

  async execute(props: VerifyCustomDomainProps): Promise<DomainVerificationResult> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    if (!workspace.customDomain) throw new DomainValidationError('No custom domain configured');
    if (!workspace.domainVerificationToken) throw new DomainValidationError('No verification token');

    const domain = workspace.customDomain;
    const token = workspace.domainVerificationToken;

    const dnsValid = await this.checkDns(domain);
    const txtValid = await keepsVerificationRecord(domain, token);

    if (dnsValid && txtValid) {
      workspace.customDomainVerified = true;
      workspace.customDomainCheckFailures = 0;
      workspace.customDomainFailingSince = null;
      await this.repository.update(workspace);
    }

    return {
      verified: dnsValid && txtValid,
      dnsValid,
      txtValid,
      cnameTarget: this.expectedCnameTarget,
      txtRecord: token,
    };
  }

  private checkDns(domain: string): Promise<boolean> {
    return pointsToInstallation(domain, this.expectedCnameTarget);
  }

}

/** Whether the domain still publishes the TXT record that proved it belongs to the workspace. */
export async function keepsVerificationRecord(domain: string, token: string): Promise<boolean> {
  try {
    const txtRecords = await dns.resolveTxt(`_oh-verify.${domain}`);
    return txtRecords.flat().some((t) => t === token);
  } catch {
    return false;
  }
}

/** Whether the domain's DNS points to the installation: a CNAME to the target, or an A record with its IPs. */
export async function pointsToInstallation(domain: string, cnameTarget: string): Promise<boolean> {
  try {
    const cnames = await dns.resolveCname(domain);
    const expected = normalizeHost(cnameTarget);
    if (cnames.some((c) => normalizeHost(c) === expected)) return true;
  } catch {}

  // Fallback: an A record resolving to the same IPs as the target
  try {
    const domainIps = await dns.resolve4(domain);
    const serverIps = await dns.resolve4(cnameTarget);
    if (domainIps.some((ip) => serverIps.includes(ip))) return true;
  } catch {}

  return false;
}
