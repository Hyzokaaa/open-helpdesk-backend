import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../../domain/entities/project';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import { ProjectModel } from '../models/project.model';

@Injectable()
export class TypeOrmProjectRepository implements ProjectRepository {
  constructor(
    @InjectRepository(ProjectModel)
    private readonly repository: Repository<ProjectModel>,
  ) {}

  async create(project: Project): Promise<void> {
    await this.repository.save(this.toModel(project));
  }

  async findById(id: string): Promise<Project | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Project[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async update(project: Project): Promise<void> {
    await this.repository.save(this.toModel(project));
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  private toDomain(model: ProjectModel): Project {
    return new Project({
      id: model.id,
      name: model.name,
      description: model.description,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(project: Project): ProjectModel {
    const model = new ProjectModel();
    model.id = project.getId();
    model.name = project.name;
    model.description = project.description;
    model.workspaceId = project.workspaceId;
    return model;
  }
}
