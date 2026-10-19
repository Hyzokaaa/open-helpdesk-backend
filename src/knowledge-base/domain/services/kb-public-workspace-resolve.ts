import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../../../workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';

/**
 * The workspace whose public knowledge base is asked for. A private one answers as if it did not
 * exist, so nothing tells an outsider what it holds.
 */
export class ResolvePublicKbWorkspace {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  async execute(slug: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace || !workspace.publicKbEnabled) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
