import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceInvitation } from '../../../domain/entities/workspace-invitation';
import { WorkspaceInvitationRepository } from '../../../domain/repositories/workspace-invitation.repository';
import { WorkspaceInvitationModel } from '../models/workspace-invitation.model';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';

@Injectable()
export class TypeOrmWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  constructor(
    @InjectRepository(WorkspaceInvitationModel)
    private readonly repository: Repository<WorkspaceInvitationModel>,
  ) {}

  async create(invitation: WorkspaceInvitation): Promise<void> {
    await this.repository.save(this.toModel(invitation));
  }

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByToken(token: string): Promise<WorkspaceInvitation | null> {
    const model = await this.repository.findOneBy({ token });
    return model ? this.toDomain(model) : null;
  }

  async findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const models = await this.repository.findBy({
      workspaceId,
      status: InvitationStatus.PENDING,
    });
    return models.map((m) => this.toDomain(m));
  }

  async findPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<WorkspaceInvitation | null> {
    const model = await this.repository.findOneBy({
      workspaceId,
      email,
      status: InvitationStatus.PENDING,
    });
    return model ? this.toDomain(model) : null;
  }

  async update(invitation: WorkspaceInvitation): Promise<void> {
    await this.repository.save(this.toModel(invitation));
  }

  private toDomain(model: WorkspaceInvitationModel): WorkspaceInvitation {
    return new WorkspaceInvitation({
      id: model.id,
      workspaceId: model.workspaceId,
      email: model.email,
      role: model.role as WorkspaceRole,
      token: model.token,
      status: model.status as InvitationStatus,
      expiresAt: model.expiresAt,
      invitedById: model.invitedById,
      createdAt: model.createdAt,
    });
  }

  private toModel(invitation: WorkspaceInvitation): WorkspaceInvitationModel {
    const model = new WorkspaceInvitationModel();
    model.id = invitation.getId();
    model.workspaceId = invitation.workspaceId;
    model.email = invitation.email;
    model.role = invitation.role;
    model.token = invitation.token;
    model.status = invitation.status;
    model.expiresAt = invitation.expiresAt;
    model.invitedById = invitation.invitedById;
    return model;
  }
}
