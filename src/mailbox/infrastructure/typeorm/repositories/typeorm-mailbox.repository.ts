import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Mailbox } from '../../../domain/entities/mailbox';
import { MailboxRepository } from '../../../domain/repositories/mailbox.repository';
import { MailboxType } from '../../../domain/enums/mailbox-type.enum';
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

  async findById(id: string): Promise<Mailbox | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByAddress(address: string): Promise<Mailbox | null> {
    const model = await this.repository.findOneBy({ address });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Mailbox | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async findAllByWorkspaceId(workspaceId: string): Promise<Mailbox[]> {
    const models = await this.repository.findBy({ workspaceId });
    return models.map((m) => this.toDomain(m));
  }

  async findAllByType(type: MailboxType): Promise<Mailbox[]> {
    const models = await this.repository.find({
      where: { type, isActive: true },
    });
    return models.map((m) => this.toDomain(m));
  }

  async update(mailbox: Mailbox): Promise<void> {
    const model = this.toModel(mailbox);
    await this.repository.save(model);
  }

  async findSystemMailbox(): Promise<Mailbox | null> {
    const model = await this.repository.findOne({ where: { workspaceId: IsNull() } });
    return model ? this.toDomain(model) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: MailboxModel): Mailbox {
    return new Mailbox({
      id: model.id,
      address: model.address,
      workspaceId: model.workspaceId,
      isActive: model.isActive,
      type: model.type as MailboxType,
      imapHost: model.imapHost,
      imapPort: model.imapPort,
      imapUser: model.imapUser,
      imapPass: model.imapPass,
      imapTls: model.imapTls,
      encryption: model.encryption,
      imapFolder: model.imapFolder,
      pollInterval: model.pollInterval,
      lastSyncAt: model.lastSyncAt,
      lastSyncDuration: model.lastSyncDuration,
      lastError: model.lastError,
      addressMode: model.addressMode,
      acceptedAddresses: model.acceptedAddresses,
      autoReply: model.autoReply,
      postProcessAction: model.postProcessAction,
      postProcessFolder: model.postProcessFolder,
    });
  }

  private toModel(mailbox: Mailbox): MailboxModel {
    const model = new MailboxModel();
    model.id = mailbox.getId();
    model.address = mailbox.address;
    model.workspaceId = mailbox.workspaceId;
    model.isActive = mailbox.isActive;
    model.type = mailbox.type;
    model.imapHost = mailbox.imapHost;
    model.imapPort = mailbox.imapPort;
    model.imapUser = mailbox.imapUser;
    model.imapPass = mailbox.imapPass;
    model.imapTls = mailbox.imapTls;
    model.encryption = mailbox.encryption;
    model.imapFolder = mailbox.imapFolder;
    model.pollInterval = mailbox.pollInterval;
    model.lastSyncAt = mailbox.lastSyncAt;
    model.lastSyncDuration = mailbox.lastSyncDuration;
    model.lastError = mailbox.lastError;
    model.addressMode = mailbox.addressMode;
    model.acceptedAddresses = mailbox.acceptedAddresses;
    model.autoReply = mailbox.autoReply;
    model.postProcessAction = mailbox.postProcessAction;
    model.postProcessFolder = mailbox.postProcessFolder;
    return model;
  }
}
