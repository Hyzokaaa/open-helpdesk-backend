import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEmailSender } from '../../../domain/entities/workspace-email-sender';
import { WorkspaceEmailSenderRepository } from '../../../domain/repositories/workspace-email-sender.repository';
import { WorkspaceEmailSenderModel } from '../models/workspace-email-sender.model';

@Injectable()
export class TypeOrmWorkspaceEmailSenderRepository implements WorkspaceEmailSenderRepository {
  constructor(
    @InjectRepository(WorkspaceEmailSenderModel)
    private readonly repository: Repository<WorkspaceEmailSenderModel>,
  ) {}

  async create(sender: WorkspaceEmailSender): Promise<void> {
    await this.repository.save(this.toModel(sender));
  }

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceEmailSender | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async update(sender: WorkspaceEmailSender): Promise<void> {
    await this.repository.save(this.toModel(sender));
  }

  async delete(workspaceId: string): Promise<void> {
    await this.repository.delete({ workspaceId });
  }

  private toDomain(model: WorkspaceEmailSenderModel): WorkspaceEmailSender {
    return new WorkspaceEmailSender({
      id: model.id,
      workspaceId: model.workspaceId,
      smtpHost: model.smtpHost,
      smtpPort: model.smtpPort,
      smtpUser: model.smtpUser,
      smtpPass: model.smtpPass,
      smtpFrom: model.smtpFrom,
      encryption: model.encryption,
    });
  }

  private toModel(sender: WorkspaceEmailSender): WorkspaceEmailSenderModel {
    const model = new WorkspaceEmailSenderModel();
    model.id = sender.getId();
    model.workspaceId = sender.workspaceId;
    model.smtpHost = sender.smtpHost;
    model.smtpPort = sender.smtpPort;
    model.smtpUser = sender.smtpUser;
    model.smtpPass = sender.smtpPass;
    model.smtpFrom = sender.smtpFrom;
    model.encryption = sender.encryption;
    return model;
  }
}
