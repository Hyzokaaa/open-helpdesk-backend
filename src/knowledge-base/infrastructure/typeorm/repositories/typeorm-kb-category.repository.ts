import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbCategory } from '../../../domain/entities/kb-category';
import { KbCategoryRepository } from '../../../domain/repositories/kb-category.repository';
import { KbCategoryModel } from '../models/kb-category.model';

@Injectable()
export class TypeOrmKbCategoryRepository implements KbCategoryRepository {
  constructor(
    @InjectRepository(KbCategoryModel)
    private readonly repository: Repository<KbCategoryModel>,
  ) {}

  async create(category: KbCategory): Promise<void> {
    await this.repository.save(this.toModel(category));
  }

  async findById(id: string): Promise<KbCategory | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<KbCategory[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findBySlugAndWorkspaceId(slug: string, workspaceId: string): Promise<KbCategory | null> {
    const model = await this.repository.findOneBy({ slug, workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async update(category: KbCategory): Promise<void> {
    await this.repository.save(this.toModel(category));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async updatePositions(items: Array<{ id: string; position: number }>): Promise<void> {
    for (const item of items) {
      await this.repository.update(item.id, { position: item.position });
    }
  }

  async getMaxPosition(workspaceId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('c')
      .select('COALESCE(MAX(c.position), -1)', 'max')
      .where('c.workspaceId = :workspaceId', { workspaceId })
      .getRawOne();
    return Number(result?.max ?? -1);
  }

  private toDomain(model: KbCategoryModel): KbCategory {
    return new KbCategory({
      id: model.id,
      name: model.name,
      slug: model.slug,
      icon: model.icon,
      position: model.position,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(category: KbCategory): KbCategoryModel {
    const model = new KbCategoryModel();
    model.id = category.getId();
    model.name = category.name;
    model.slug = category.slug;
    model.icon = category.icon;
    model.position = category.position;
    model.workspaceId = category.workspaceId;
    return model;
  }
}
