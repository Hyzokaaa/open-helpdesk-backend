import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';

interface Props {
  slug: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export class GetWorkspaceQuery implements Query<Props, WorkspaceResponse> {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: Props): Promise<WorkspaceResponse> {
    const workspace = await this.repository.findBySlug(props.slug);
    if (!workspace) {
      throw new EntityNotFoundError('Workspace not found');
    }

    return {
      id: workspace.getId(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
    };
  }
}
