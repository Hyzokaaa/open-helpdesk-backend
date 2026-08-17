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
    const txtValid = await this.checkTxt(domain, token);

    if (dnsValid && txtValid) {
      workspace.customDomainVerified = true;
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

  private async checkDns(domain: string): Promise<boolean> {
    // Check CNAME first
    try {
      const cnames = await dns.resolveCname(domain);
      if (cnames.some((c) => c.toLowerCase().includes(this.expectedCnameTarget.toLowerCase()))) {
        return true;
      }
    } catch {}

    // Fallback: check if A record resolves to same IPs as our server
    try {
      const domainIps = await dns.resolve4(domain);
      const serverIps = await dns.resolve4(this.expectedCnameTarget);
      if (domainIps.some((ip) => serverIps.includes(ip))) {
        return true;
      }
    } catch {}

    return false;
  }

  private async checkTxt(domain: string, token: string): Promise<boolean> {
    try {
      const txtRecords = await dns.resolveTxt(`_oh-verify.${domain}`);
      return txtRecords.flat().some((t) => t === token);
    } catch {
      return false;
    }
  }
}
