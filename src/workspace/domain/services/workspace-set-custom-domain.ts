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
    private readonly frontendHosts: string[] = [],
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

    if (this.frontendHosts.some((host) => host === domain)) {
      throw new DomainValidationError('This hostname is already the platform URL. Custom domain is not needed for routing.');
    }

    workspace.customDomain = domain;
    workspace.customDomainVerified = !!props.autoVerify;
    workspace.domainVerificationToken = props.autoVerify ? null : `oh-verify=${randomBytes(16).toString('hex')}`;
    await this.repository.update(workspace);
    return workspace;
  }
}
