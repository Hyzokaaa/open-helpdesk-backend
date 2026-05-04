import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CannedResponse } from '../../../domain/entities/canned-response';
import { CannedResponseRepository } from '../../../domain/repositories/canned-response.repository';
import { CannedResponseModel } from '../models/canned-response.model';

@Injectable()
export class TypeOrmCannedResponseRepository implements CannedResponseRepository {
  constructor(
    @InjectRepository(CannedResponseModel)
    private readonly repository: Repository<CannedResponseModel>,
  ) {}

  async create(cannedResponse: CannedResponse): Promise<void> {
    const model = this.toModel(cannedResponse);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<CannedResponse | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<CannedResponse[]> {
    const models = await this.repository.findBy({ workspaceId });
    return models.map((m) => this.toDomain(m));
  }

  async update(cannedResponse: CannedResponse): Promise<void> {
    const model = this.toModel(cannedResponse);
    await this.repository.save(model);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: CannedResponseModel): CannedResponse {
    return new CannedResponse({
      id: model.id,
      title: model.title,
      content: model.content,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(cannedResponse: CannedResponse): CannedResponseModel {
    const model = new CannedResponseModel();
    model.id = cannedResponse.getId();
    model.title = cannedResponse.title;
    model.content = cannedResponse.content;
    model.workspaceId = cannedResponse.workspaceId;
    return model;
  }
}
