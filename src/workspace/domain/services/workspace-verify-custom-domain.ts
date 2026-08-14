import { promises as dns } from 'dns';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface VerifyCustomDomainProps {
  workspaceId: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  cnameValid: boolean;
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

    let cnameValid = false;
    let txtValid = false;

    try {
      const cnames = await dns.resolveCname(domain);
      cnameValid = cnames.some((c) => c.toLowerCase().includes(this.expectedCnameTarget.toLowerCase()));
    } catch {}

    try {
      const txtRecords = await dns.resolveTxt(`_oh-verify.${domain}`);
      txtValid = txtRecords.flat().some((t) => t === token);
    } catch {}

    if (cnameValid && txtValid) {
      workspace.customDomainVerified = true;
      await this.repository.update(workspace);
    }

    return {
      verified: cnameValid && txtValid,
      cnameValid,
      txtValid,
      cnameTarget: this.expectedCnameTarget,
      txtRecord: token,
    };
  }
}
