import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../../../domain/entities/workspace';
import { WorkspaceRepository } from '../../../domain/repositories/workspace.repository';
import { WorkspaceModel } from '../models/workspace.model';

@Injectable()
export class TypeOrmWorkspaceRepository implements WorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceModel)
    private readonly repository: Repository<WorkspaceModel>,
  ) {}

  async create(workspace: Workspace): Promise<void> {
    const model = this.toModel(workspace);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Workspace | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const model = await this.repository.findOneBy({ slug });
    return model ? this.toDomain(model) : null;
  }

  async findAll(): Promise<Workspace[]> {
    const models = await this.repository.find();
    return models.map((m) => this.toDomain(m));
  }

  async update(workspace: Workspace): Promise<void> {
    const model = this.toModel(workspace);
    await this.repository.save(model);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return await this.repository.existsBy({ slug });
  }

  async countByAccountId(accountId: string): Promise<number> {
    return this.repository.count({ where: { accountId } });
  }

  private toDomain(model: WorkspaceModel): Workspace {
    return new Workspace({
      id: model.id,
      name: model.name,
      slug: model.slug,
      description: model.description,
      accountId: model.accountId,
    });
  }

  private toModel(workspace: Workspace): WorkspaceModel {
    const model = new WorkspaceModel();
    model.id = workspace.getId();
    model.name = workspace.name;
    model.slug = workspace.slug;
    model.description = workspace.description;
    model.accountId = workspace.accountId;
    return model;
  }
}
