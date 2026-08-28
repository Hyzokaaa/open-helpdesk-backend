import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Project } from '../entities/project';
import { ProjectRepository } from '../repositories/project.repository';

interface UpdateProjectProps {
  id: string;
  name?: string;
  description?: string | null;
}

export class UpdateProject {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(props: UpdateProjectProps): Promise<Project> {
    const project = await this.repository.findById(props.id);
    if (!project) throw new EntityNotFoundError('Project not found');

    if (props.name !== undefined) project.name = props.name;
    if (props.description !== undefined) project.description = props.description;

    await this.repository.update(project);
    return project;
  }
}
