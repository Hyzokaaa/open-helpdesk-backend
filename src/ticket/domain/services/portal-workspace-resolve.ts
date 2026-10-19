import { EntityNotFoundError, PortalClosedError } from '../../../shared/domain/errors';
import { Workspace } from '../../../workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';

/** The workspace whose portal is asked for, when it exists and its portal is open. */
export class ResolvePortalWorkspace {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  async execute(slug: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    if (!workspace.portalEnabled) throw new PortalClosedError('This portal requires signing in');
    return workspace;
  }
}
