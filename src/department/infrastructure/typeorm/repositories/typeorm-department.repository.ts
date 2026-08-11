import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../../domain/entities/department';
import { DepartmentRepository } from '../../../domain/repositories/department.repository';
import { DepartmentModel } from '../models/department.model';

@Injectable()
export class TypeOrmDepartmentRepository implements DepartmentRepository {
  constructor(
    @InjectRepository(DepartmentModel)
    private readonly repository: Repository<DepartmentModel>,
  ) {}

  async create(department: Department): Promise<void> {
    const model = this.toModel(department);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Department | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Department[]> {
    const models = await this.repository.findBy({ workspaceId });
    return models.map((m) => this.toDomain(m));
  }

  async update(department: Department): Promise<void> {
    const model = this.toModel(department);
    await this.repository.save(model);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  private toDomain(model: DepartmentModel): Department {
    return new Department({
      id: model.id,
      name: model.name,
      description: model.description,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(department: Department): DepartmentModel {
    const model = new DepartmentModel();
    model.id = department.getId();
    model.name = department.name;
    model.description = department.description;
    model.workspaceId = department.workspaceId;
    return model;
  }
}
