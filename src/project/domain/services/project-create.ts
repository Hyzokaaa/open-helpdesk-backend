import { IdGenerator } from '../../../shared/domain/id-generator';
import { Project } from '../entities/project';
import { ProjectRepository } from '../repositories/project.repository';

interface CreateProjectProps {
  name: string;
  description?: string | null;
  workspaceId: string;
}

export class CreateProject {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: ProjectRepository,
  ) {}

  async execute(props: CreateProjectProps): Promise<Project> {
    const project = new Project({
      id: this.idGenerator.create(),
      name: props.name,
      description: props.description ?? null,
      workspaceId: props.workspaceId,
    });
    await this.repository.create(project);
    return project;
  }
}
