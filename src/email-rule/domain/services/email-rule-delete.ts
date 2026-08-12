import { EntityNotFoundError } from '../../../shared/domain/errors';
import { EmailRuleRepository } from '../repositories/email-rule.repository';

export class DeleteEmailRule {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(id: string): Promise<void> {
    const rule = await this.repository.findById(id);
    if (!rule) throw new EntityNotFoundError('Email rule not found');
    await this.repository.delete(id);
  }
}
