import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from '../../../domain/entities/tag';
import { TagRepository } from '../../../domain/repositories/tag.repository';
import { TagModel } from '../models/tag.model';

@Injectable()
export class TypeOrmTagRepository implements TagRepository {
  constructor(
    @InjectRepository(TagModel)
    private readonly repository: Repository<TagModel>,
  ) {}

  async create(tag: Tag): Promise<void> {
    const model = this.toModel(tag);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Tag | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    const models = await this.repository.findBy({ id: In(ids) });
    return models.map((m) => this.toDomain(m));
  }

  async findByWorkspaceId(workspaceId: string): Promise<Tag[]> {
    const models = await this.repository.findBy({ workspaceId });
    return models.map((m) => this.toDomain(m));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: TagModel): Tag {
    return new Tag({
      id: model.id,
      name: model.name,
      color: model.color,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(tag: Tag): TagModel {
    const model = new TagModel();
    model.id = tag.getId();
    model.name = tag.name;
    model.color = tag.color;
    model.workspaceId = tag.workspaceId;
    return model;
  }
}
