import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategory } from '../../../domain/entities/ticket-category';
import { TicketCategoryRepository } from '../../../domain/repositories/ticket-category.repository';
import { TicketCategoryModel } from '../models/ticket-category.model';
import { ProjectCategoryModel } from '../models/project-category.model';

@Injectable()
export class TypeOrmTicketCategoryRepository implements TicketCategoryRepository {
  constructor(
    @InjectRepository(TicketCategoryModel)
    private readonly repository: Repository<TicketCategoryModel>,
    @InjectRepository(ProjectCategoryModel)
    private readonly projectCategoryRepository: Repository<ProjectCategoryModel>,
  ) {}

  async create(category: TicketCategory): Promise<void> {
    await this.repository.save(this.toModel(category));
  }

  async createMany(categories: TicketCategory[]): Promise<void> {
    await this.repository.save(categories.map((c) => this.toModel(c)));
  }

  async findById(id: string): Promise<TicketCategory | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<TicketCategory[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findBySlugAndWorkspace(slug: string, workspaceId: string): Promise<TicketCategory | null> {
    const model = await this.repository.findOneBy({ slug, workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async findByProjectId(projectId: string): Promise<TicketCategory[]> {
    const links = await this.projectCategoryRepository.find({
      where: { projectId },
      relations: ['category'],
    });
    return links
      .filter((l) => l.category)
      .map((l) => this.toDomain(l.category))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(category: TicketCategory): Promise<void> {
    await this.repository.save(this.toModel(category));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async addToProject(projectId: string, categoryId: string): Promise<void> {
    await this.projectCategoryRepository.save({ projectId, categoryId });
  }

  async removeFromProject(projectId: string, categoryId: string): Promise<void> {
    await this.projectCategoryRepository.delete({ projectId, categoryId });
  }

  async findProjectCategoryIds(projectId: string): Promise<string[]> {
    const links = await this.projectCategoryRepository.find({ where: { projectId } });
    return links.map((l) => l.categoryId);
  }

  private toDomain(model: TicketCategoryModel): TicketCategory {
    return new TicketCategory({
      id: model.id,
      name: model.name,
      slug: model.slug,
      color: model.color,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(category: TicketCategory): TicketCategoryModel {
    const model = new TicketCategoryModel();
    model.id = category.getId();
    model.name = category.name;
    model.slug = category.slug;
    model.color = category.color;
    model.workspaceId = category.workspaceId;
    return model;
  }
}
