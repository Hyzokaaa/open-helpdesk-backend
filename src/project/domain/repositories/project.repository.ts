import { Project } from '../entities/project';

export interface ProjectRepository {
  create(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
  findByWorkspaceId(workspaceId: string): Promise<Project[]>;
  update(project: Project): Promise<void>;
  softDelete(id: string): Promise<void>;
}
