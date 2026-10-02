import { AccessDeniedError } from '../../../shared/domain/errors';
import { ResolveWorkspaceCreationPolicy } from './workspace-creation-policy-resolve';

interface EnsureCanCreateWorkspaceProps {
  isSystemAdmin: boolean;
}

export class EnsureCanCreateWorkspace {
  constructor(private readonly resolvePolicy: ResolveWorkspaceCreationPolicy) {}

  async execute(props: EnsureCanCreateWorkspaceProps): Promise<void> {
    if (props.isSystemAdmin) return;
    const policy = await this.resolvePolicy.execute();
    if (!policy.selfService) {
      throw new AccessDeniedError('Only system administrators can create workspaces');
    }
  }
}
