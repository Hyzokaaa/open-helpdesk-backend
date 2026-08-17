import { randomBytes } from 'crypto';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface SetCustomDomainProps {
  workspaceId: string;
  domain: string | null;
  autoVerify?: boolean;
}

const DOMAIN_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;

export class SetCustomDomain {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly primaryHost: string = '',
  ) {}

  async execute(props: SetCustomDomainProps): Promise<Workspace> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    if (props.domain === null) {
      workspace.customDomain = null;
      workspace.customDomainVerified = false;
      workspace.domainVerificationToken = null;
      await this.repository.update(workspace);
      return workspace;
    }

    const domain = props.domain.toLowerCase().trim();
    if (!DOMAIN_REGEX.test(domain)) {
      throw new DomainValidationError('Invalid domain format');
    }

    if (this.primaryHost && this.primaryHost === domain) {
      throw new DomainValidationError(`"${domain}" is the platform's own URL and cannot be used as a custom domain. Use a different hostname (e.g. helpdesk.yourcompany.com).`);
    }

    workspace.customDomain = domain;
    workspace.customDomainVerified = !!props.autoVerify;
    workspace.domainVerificationToken = props.autoVerify ? null : `oh-verify=${randomBytes(16).toString('hex')}`;
    await this.repository.update(workspace);
    return workspace;
  }
}
