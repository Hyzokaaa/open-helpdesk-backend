import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailRule } from '../../../domain/entities/email-rule';
import { EmailRuleRepository } from '../../../domain/repositories/email-rule.repository';
import { EmailRuleModel } from '../models/email-rule.model';

@Injectable()
export class TypeOrmEmailRuleRepository implements EmailRuleRepository {
  constructor(
    @InjectRepository(EmailRuleModel)
    private readonly repository: Repository<EmailRuleModel>,
  ) {}

  async create(rule: EmailRule): Promise<void> {
    await this.repository.save(this.toModel(rule));
  }

  async update(rule: EmailRule): Promise<void> {
    await this.repository.save(this.toModel(rule));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findById(id: string): Promise<EmailRule | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<EmailRule[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  private toDomain(model: EmailRuleModel): EmailRule {
    return new EmailRule({
      id: model.id,
      workspaceId: model.workspaceId,
      name: model.name,
      position: model.position,
      isActive: model.isActive,
      mailboxIds: model.mailboxIds ?? [],
      conditions: model.conditions ?? [],
      actions: model.actions ?? [],
    });
  }

  private toModel(rule: EmailRule): EmailRuleModel {
    const model = new EmailRuleModel();
    model.id = rule.getId();
    model.workspaceId = rule.workspaceId;
    model.name = rule.name;
    model.position = rule.position;
    model.isActive = rule.isActive;
    model.mailboxIds = rule.mailboxIds;
    model.conditions = rule.conditions;
    model.actions = rule.actions;
    return model;
  }
}
