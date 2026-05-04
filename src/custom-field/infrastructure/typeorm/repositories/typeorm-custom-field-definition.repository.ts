import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomFieldDefinition } from '../../../domain/entities/custom-field-definition';
import { CustomFieldType } from '../../../domain/enums/custom-field-type.enum';
import { CustomFieldDefinitionRepository } from '../../../domain/repositories/custom-field-definition.repository';
import { CustomFieldDefinitionModel } from '../models/custom-field-definition.model';

@Injectable()
export class TypeOrmCustomFieldDefinitionRepository implements CustomFieldDefinitionRepository {
  constructor(
    @InjectRepository(CustomFieldDefinitionModel)
    private readonly repository: Repository<CustomFieldDefinitionModel>,
  ) {}

  async create(definition: CustomFieldDefinition): Promise<void> {
    await this.repository.save(this.toModel(definition));
  }

  async findById(id: string): Promise<CustomFieldDefinition | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<CustomFieldDefinition[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async update(definition: CustomFieldDefinition): Promise<void> {
    await this.repository.save(this.toModel(definition));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async updatePositions(items: { id: string; position: number }[]): Promise<void> {
    for (const item of items) {
      await this.repository.update(item.id, { position: item.position });
    }
  }

  private toDomain(model: CustomFieldDefinitionModel): CustomFieldDefinition {
    return new CustomFieldDefinition({
      id: model.id,
      workspaceId: model.workspaceId,
      name: model.name,
      type: model.type as CustomFieldType,
      options: model.options,
      position: model.position,
      required: model.required,
    });
  }

  private toModel(definition: CustomFieldDefinition): CustomFieldDefinitionModel {
    const model = new CustomFieldDefinitionModel();
    model.id = definition.getId();
    model.workspaceId = definition.workspaceId;
    model.name = definition.name;
    model.type = definition.type;
    model.options = definition.options;
    model.position = definition.position;
    model.required = definition.required;
    return model;
  }
}
