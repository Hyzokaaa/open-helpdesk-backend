import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from '../../../domain/entities/workspace-member';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../../../domain/repositories/workspace-member.repository';
import { WorkspaceMemberModel } from '../models/workspace-member.model';

@Injectable()
export class TypeOrmWorkspaceMemberRepository implements WorkspaceMemberRepository {
  constructor(
    @InjectRepository(WorkspaceMemberModel)
    private readonly repository: Repository<WorkspaceMemberModel>,
  ) {}

  async create(member: WorkspaceMember): Promise<void> {
    const model = this.toModel(member);
    await this.repository.save(model);
  }

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceMember[]> {
    const models = await this.repository.findBy({ workspaceId });
    return models.map((m) => this.toDomain(m));
  }

  async findByUserId(userId: string): Promise<WorkspaceMember[]> {
    const models = await this.repository.findBy({ userId });
    return models.map((m) => this.toDomain(m));
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const model = await this.repository.findOneBy({ workspaceId, userId });
    return model ? this.toDomain(model) : null;
  }

  async update(member: WorkspaceMember): Promise<void> {
    const model = this.toModel(member);
    await this.repository.save(model);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: WorkspaceMemberModel): WorkspaceMember {
    return new WorkspaceMember({
      id: model.id,
      workspaceId: model.workspaceId,
      userId: model.userId,
      role: model.role as WorkspaceRole,
    });
  }

  private toModel(member: WorkspaceMember): WorkspaceMemberModel {
    const model = new WorkspaceMemberModel();
    model.id = member.getId();
    model.workspaceId = member.workspaceId;
    model.userId = member.userId;
    model.role = member.role;
    return model;
  }
}
