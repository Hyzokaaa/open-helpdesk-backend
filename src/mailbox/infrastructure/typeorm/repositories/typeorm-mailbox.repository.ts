import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mailbox } from '../../../domain/entities/mailbox';
import { MailboxRepository } from '../../../domain/repositories/mailbox.repository';
import { MailboxModel } from '../models/mailbox.model';

@Injectable()
export class TypeOrmMailboxRepository implements MailboxRepository {
  constructor(
    @InjectRepository(MailboxModel)
    private readonly repository: Repository<MailboxModel>,
  ) {}

  async create(mailbox: Mailbox): Promise<void> {
    const model = this.toModel(mailbox);
    await this.repository.save(model);
  }

  async findByAddress(address: string): Promise<Mailbox | null> {
    const model = await this.repository.findOneBy({ address });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Mailbox | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? this.toDomain(model) : null;
  }

  private toDomain(model: MailboxModel): Mailbox {
    return new Mailbox({
      id: model.id,
      address: model.address,
      workspaceId: model.workspaceId,
      isActive: model.isActive,
    });
  }

  private toModel(mailbox: Mailbox): MailboxModel {
    const model = new MailboxModel();
    model.id = mailbox.getId();
    model.address = mailbox.address;
    model.workspaceId = mailbox.workspaceId;
    model.isActive = mailbox.isActive;
    return model;
  }
}
