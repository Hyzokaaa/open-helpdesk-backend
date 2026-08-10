import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMember } from '../../../domain/entities/department-member';
import { DepartmentMemberRepository } from '../../../domain/repositories/department-member.repository';
import { DepartmentMemberModel } from '../models/department-member.model';

@Injectable()
export class TypeOrmDepartmentMemberRepository implements DepartmentMemberRepository {
  constructor(
    @InjectRepository(DepartmentMemberModel)
    private readonly repository: Repository<DepartmentMemberModel>,
  ) {}

  async create(member: DepartmentMember): Promise<void> {
    const model = this.toModel(member);
    await this.repository.save(model);
  }

  async delete(departmentId: string, userId: string): Promise<void> {
    await this.repository.delete({ departmentId, userId });
  }

  async findByDepartmentId(departmentId: string): Promise<DepartmentMember[]> {
    const models = await this.repository.findBy({ departmentId });
    return models.map((m) => this.toDomain(m));
  }

  async findByUserId(userId: string): Promise<DepartmentMember[]> {
    const models = await this.repository.findBy({ userId });
    return models.map((m) => this.toDomain(m));
  }

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<DepartmentMember[]> {
    const models = await this.repository
      .createQueryBuilder('dm')
      .innerJoin('dm.department', 'department')
      .where('department.workspaceId = :workspaceId', { workspaceId })
      .andWhere('dm.userId = :userId', { userId })
      .getMany();
    return models.map((m) => this.toDomain(m));
  }

  private toDomain(model: DepartmentMemberModel): DepartmentMember {
    return new DepartmentMember({
      id: model.id,
      departmentId: model.departmentId,
      userId: model.userId,
    });
  }

  private toModel(member: DepartmentMember): DepartmentMemberModel {
    const model = new DepartmentMemberModel();
    model.id = member.getId();
    model.departmentId = member.departmentId;
    model.userId = member.userId;
    return model;
  }
}
