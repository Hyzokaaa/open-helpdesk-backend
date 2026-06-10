import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../../../domain/entities/api-key';
import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository';
import { ApiKeyModel } from '../models/api-key.model';

@Injectable()
export class TypeOrmApiKeyRepository implements ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyModel)
    private readonly repository: Repository<ApiKeyModel>,
  ) {}

  async create(apiKey: ApiKey): Promise<void> {
    await this.repository.save({
      id: apiKey.getId(),
      workspaceId: apiKey.workspaceId,
      name: apiKey.name,
      key: apiKey.key,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdById: apiKey.createdById,
    });
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const model = await this.repository.findOneBy({ key: keyHash });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<ApiKey[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findById(id: string): Promise<ApiKey | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async updateLastUsedAt(id: string, date: Date): Promise<void> {
    await this.repository.update(id, { lastUsedAt: date });
  }

  private toDomain(model: ApiKeyModel): ApiKey {
    return new ApiKey({
      id: model.id,
      workspaceId: model.workspaceId,
      name: model.name,
      key: model.key,
      prefix: model.prefix,
      scopes: model.scopes,
      expiresAt: model.expiresAt,
      lastUsedAt: model.lastUsedAt,
      createdAt: model.createdAt,
      createdById: model.createdById,
    });
  }
}
