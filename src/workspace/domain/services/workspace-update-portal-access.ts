import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceRepository } from '../repositories/workspace.repository';

export interface PortalAccess {
  portalEnabled: boolean;
  publicKbEnabled: boolean;
}

interface Props {
  workspaceId: string;
  /** Only what is given changes */
  portalEnabled?: boolean;
  publicKbEnabled?: boolean;
}

/**
 * Opens or closes what people can do without signing in: the portal (opening tickets and following
 * them through their email link) and, separately, reading the published knowledge base.
 */
export class UpdateWorkspacePortalAccess {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: Props): Promise<{ before: PortalAccess; after: PortalAccess }> {
    if (props.portalEnabled === undefined && props.publicKbEnabled === undefined) {
      throw new DomainValidationError('Nothing to change');
    }
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const before = { portalEnabled: workspace.portalEnabled, publicKbEnabled: workspace.publicKbEnabled };
    workspace.portalEnabled = props.portalEnabled ?? workspace.portalEnabled;
    workspace.publicKbEnabled = props.publicKbEnabled ?? workspace.publicKbEnabled;
    await this.repository.update(workspace);
    return { before, after: { portalEnabled: workspace.portalEnabled, publicKbEnabled: workspace.publicKbEnabled } };
  }
}
