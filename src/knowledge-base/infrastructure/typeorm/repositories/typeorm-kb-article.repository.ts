import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbArticle } from '../../../domain/entities/kb-article';
import { KbArticleStatus } from '../../../domain/enums/kb-article-status.enum';
import { KbArticleRepository } from '../../../domain/repositories/kb-article.repository';
import { KbArticleModel } from '../models/kb-article.model';

@Injectable()
export class TypeOrmKbArticleRepository implements KbArticleRepository {
  constructor(
    @InjectRepository(KbArticleModel)
    private readonly repository: Repository<KbArticleModel>,
  ) {}

  async create(article: KbArticle): Promise<void> {
    await this.repository.save(this.toModel(article));
  }

  async findById(id: string): Promise<KbArticle | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<KbArticle[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findPublishedByWorkspaceId(workspaceId: string): Promise<KbArticle[]> {
    const models = await this.repository.find({
      where: { workspaceId, status: KbArticleStatus.PUBLISHED },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findByCategoryId(categoryId: string): Promise<KbArticle[]> {
    const models = await this.repository.find({
      where: { categoryId },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findPublishedByCategoryId(categoryId: string): Promise<KbArticle[]> {
    const models = await this.repository.find({
      where: { categoryId, status: KbArticleStatus.PUBLISHED },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findBySlugAndWorkspaceId(slug: string, workspaceId: string): Promise<KbArticle | null> {
    const model = await this.repository.findOneBy({ slug, workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async searchPublished(workspaceId: string, query: string): Promise<KbArticle[]> {
    const models = await this.repository
      .createQueryBuilder('a')
      .where('a.workspaceId = :workspaceId', { workspaceId })
      .andWhere('a.status = :status', { status: KbArticleStatus.PUBLISHED })
      .andWhere('(a.title ILIKE :q OR a.content ILIKE :q)', { q: `%${query}%` })
      .orderBy('a.position', 'ASC')
      .getMany();
    return models.map((m) => this.toDomain(m));
  }

  async update(article: KbArticle): Promise<void> {
    await this.repository.save(this.toModel(article));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async updatePositions(items: Array<{ id: string; position: number }>): Promise<void> {
    for (const item of items) {
      await this.repository.update(item.id, { position: item.position });
    }
  }

  async getMaxPosition(categoryId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('a')
      .select('COALESCE(MAX(a.position), -1)', 'max')
      .where('a.categoryId = :categoryId', { categoryId })
      .getRawOne();
    return Number(result?.max ?? -1);
  }

  private toDomain(model: KbArticleModel): KbArticle {
    return new KbArticle({
      id: model.id,
      title: model.title,
      slug: model.slug,
      content: model.content,
      status: model.status as KbArticleStatus,
      position: model.position,
      categoryId: model.categoryId,
      workspaceId: model.workspaceId,
      createdById: model.createdById,
    });
  }

  private toModel(article: KbArticle): KbArticleModel {
    const model = new KbArticleModel();
    model.id = article.getId();
    model.title = article.title;
    model.slug = article.slug;
    model.content = article.content;
    model.status = article.status;
    model.position = article.position;
    model.categoryId = article.categoryId;
    model.workspaceId = article.workspaceId;
    model.createdById = article.createdById;
    return model;
  }
}
