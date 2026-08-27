import { EntityNotFoundError } from '../../../shared/domain/errors';
import { ProjectRepository } from '../repositories/project.repository';

export class DeleteProject {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(id: string): Promise<void> {
    const project = await this.repository.findById(id);
    if (!project) throw new EntityNotFoundError('Project not found');
    await this.repository.softDelete(id);
  }
}
