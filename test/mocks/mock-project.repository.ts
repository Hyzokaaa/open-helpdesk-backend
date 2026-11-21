import { Project } from '../../src/project/domain/entities/project';
import { ProjectRepository } from '../../src/project/domain/repositories/project.repository';

export class MockProjectRepository implements ProjectRepository {
  projects: Project[] = [];

  async create(project: Project): Promise<void> {
    this.projects.push(project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.find((p) => p.getId() === id) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Project[]> {
    return this.projects.filter((p) => p.workspaceId === workspaceId);
  }

  async update(project: Project): Promise<void> {
    const i = this.projects.findIndex((p) => p.getId() === project.getId());
    if (i >= 0) this.projects[i] = project;
  }

  async softDelete(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.getId() !== id);
  }
}
